import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { GenerationJob } from '../entities/generation-job.entity';
import { GenerationJobItem } from '../entities/generation-job-item.entity';
import { ProductsService } from '../products/products.service';
import { ScenesService } from '../scenes/scenes.service';
import { ReferencesService } from '../references/references.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { GenerationMode, JobStatus, JobItemStatus, QUEUE_NAMES, GEMINI_MODELS } from '../common/enums';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @InjectRepository(GenerationJob) private jobRepo: Repository<GenerationJob>,
    @InjectRepository(GenerationJobItem) private itemRepo: Repository<GenerationJobItem>,
    private productsService: ProductsService,
    private scenesService: ScenesService,
    private referencesService: ReferencesService,
    @InjectQueue(QUEUE_NAMES.IMAGE_GENERATION) private imageQueue: Queue,
  ) {}

  async createJob(userId: string, dto: CreateGenerationDto): Promise<GenerationJob> {
    // Validate product exists and belongs to user
    const product = await this.productsService.findOne(dto.productId, userId);
    if (!product.analysisJson) {
      throw new BadRequestException('Product must be analyzed before generation. Call POST /products/:id/analyze first.');
    }

    // Validate scene if provided
    if (dto.sceneId) {
      const scene = await this.scenesService.findOne(dto.sceneId);
      if (!scene) throw new BadRequestException(`Scene ${dto.sceneId} not found`);
    }

    // Validate reference if provided
    if (dto.referenceId) {
      const ref = await this.referencesService.findOne(dto.referenceId, userId);
      if (dto.mode === GenerationMode.REFERENCE_FUSION && !ref.analysisJson) {
        throw new BadRequestException('Reference must be analyzed before Reference Fusion. Call POST /references/:id/analyze first.');
      }
    }

    // Determine which Gemini model to use (D005)
    const imageModelName = this.selectModel(dto.mode);

    // Create job
    const job = this.jobRepo.create({
      userId,
      productId: dto.productId,
      referenceId: dto.referenceId || null,
      jobMode: dto.mode,
      sceneId: dto.sceneId || null,
      modelId: dto.modelId || null,
      referenceStrategy: dto.referenceStrategy || null,
      outputRatio: dto.outputRatio || '3:4',
      resolution: dto.resolution || '2k',
      requestedPackage: dto.packageType || 'single',
      imageModelName,
      status: JobStatus.QUEUED,
      progress: 0,
    });

    const savedJob = await this.jobRepo.save(job);

    // ── Create job items ──
    if (dto.mode === GenerationMode.RETOUCH) {
      // Multi-angle retouch: 4 items, one per angle
      await this.createRetouchMultiAngleItems(savedJob, dto, userId);
    } else {
      // Single item for other modes
      const item = this.itemRepo.create({
        jobId: savedJob.id,
        itemType: 'image',
        mode: dto.mode,
        status: JobItemStatus.QUEUED,
      });
      await this.itemRepo.save(item);

      await this.imageQueue.add('generate-image', {
        jobId: savedJob.id,
        itemId: item.id,
        userId,
        productId: dto.productId,
        mode: dto.mode,
        sceneId: dto.sceneId,
        referenceId: dto.referenceId,
        referenceStrategy: dto.referenceStrategy,
        modelId: dto.modelId,
        outputRatio: dto.outputRatio || '3:4',
        imageModelName,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      });
    }

    this.logger.log(`Job ${savedJob.id} created and queued for ${dto.mode}`);
    return savedJob;
  }

  async getJobStatus(jobId: string, userId: string): Promise<any> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, userId },
      relations: ['items'],
    });
    if (!job) return null;

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      mode: job.jobMode,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      items: job.items?.map((item) => ({
        id: item.id,
        type: item.itemType,
        mode: item.mode,
        poseKey: item.poseKey,
        status: item.status,
        attempts: item.workerAttemptCount,
        outputImageId: item.outputImageId,
        errorMessage: item.errorMessage,
      })),
    };
  }

  async listJobs(userId: string): Promise<GenerationJob[]> {
    return this.jobRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async updateJobStatus(jobId: string, status: JobStatus, progress?: number, error?: string): Promise<void> {
    const update: any = { status };
    if (progress !== undefined) update.progress = progress;
    if (error) update.errorMessage = error;
    await this.jobRepo.update(jobId, update);
  }

  async updateItemStatus(itemId: string, status: JobItemStatus, outputImageId?: string, error?: string): Promise<void> {
    const update: any = { status };
    if (outputImageId) update.outputImageId = outputImageId;
    if (error) update.errorMessage = error;
    await this.itemRepo.update(itemId, update);
    await this.itemRepo.increment({ id: itemId }, 'workerAttemptCount', 1);
  }

  private selectModel(mode: GenerationMode): string {
    // D005: Flash for simple modes, Pro for complex
    switch (mode) {
      case GenerationMode.RETOUCH:
      case GenerationMode.READY_SCENE:
        return GEMINI_MODELS.FLASH_IMAGE;
      case GenerationMode.REFERENCE_FUSION:
      case GenerationMode.MODEL_SHOWCASE:
      case GenerationMode.EXPERIENCE:
        return GEMINI_MODELS.PRO_IMAGE;
      default:
        return GEMINI_MODELS.FLASH_IMAGE;
    }
  }

  // ── Multi-angle retouch: 4 angles ──

  static readonly RETOUCH_ANGLES = ['front', 'three_quarter', 'side', 'top_down'] as const;

  private async createRetouchMultiAngleItems(
    job: GenerationJob,
    dto: CreateGenerationDto,
    userId: string,
  ): Promise<void> {
    const imageModelName = this.selectModel(dto.mode);

    for (const angle of GenerationService.RETOUCH_ANGLES) {
      const item = this.itemRepo.create({
        jobId: job.id,
        itemType: 'image',
        mode: dto.mode,
        poseKey: angle,
        status: JobItemStatus.QUEUED,
      });
      await this.itemRepo.save(item);

      await this.imageQueue.add('generate-image', {
        jobId: job.id,
        itemId: item.id,
        userId,
        productId: dto.productId,
        mode: dto.mode,
        poseKey: angle,
        outputRatio: dto.outputRatio || '1:1',
        imageModelName,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      });
    }

    this.logger.log(`Retouch multi-angle: 4 items created for job ${job.id}`);
  }

  /** Called by ImageWorker after each item completes — checks if all items are done */
  async checkJobCompletion(jobId: string): Promise<void> {
    const items = await this.itemRepo.find({ where: { jobId } });
    const total = items.length;
    const completed = items.filter(i => i.status === JobItemStatus.COMPLETED).length;
    const failed = items.filter(i => i.status === JobItemStatus.FAILED).length;
    const done = completed + failed;

    // Update progress
    const progress = Math.round((done / total) * 90) + 10; // 10-100 range
    await this.jobRepo.update(jobId, { progress: Math.min(progress, 95) });

    if (done === total) {
      // All items finished
      if (failed === total) {
        await this.jobRepo.update(jobId, { status: JobStatus.FAILED, progress: 100 });
      } else {
        await this.jobRepo.update(jobId, { status: JobStatus.COMPLETED, progress: 100 });
      }
      this.logger.log(`Job ${jobId} complete: ${completed}/${total} succeeded, ${failed} failed`);
    }
  }
}
