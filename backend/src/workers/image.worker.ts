import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GenerationJob } from '../entities/generation-job.entity';
import { GenerationJobItem } from '../entities/generation-job-item.entity';
import { GeneratedImage } from '../entities/generated-image.entity';
import { Product } from '../entities/product.entity';
import { Reference } from '../entities/reference.entity';
import { Scene } from '../entities/scene.entity';
import { UserModel } from '../entities/user-model.entity';
import { StorageService } from '../storage/storage.service';
import { PromptComposerService, PromptComposeInput } from '../prompt/prompt-composer.service';
import { QUEUE_NAMES, JobStatus, JobItemStatus, GenerationMode } from '../common/enums';
import { randomUUID } from 'crypto';

interface ImageJobData {
  jobId: string;
  itemId: string;
  userId: string;
  productId: string;
  mode: GenerationMode;
  sceneId?: string;
  referenceId?: string;
  referenceStrategy?: string;
  modelId?: string;
  outputRatio?: string;
  imageModelName: string;
}

@Processor(QUEUE_NAMES.IMAGE_GENERATION, {
  concurrency: 2,
  limiter: { max: 5, duration: 60000 }, // max 5 jobs per minute (Gemini rate limits)
})
export class ImageWorker extends WorkerHost {
  private readonly logger = new Logger(ImageWorker.name);

  constructor(
    @InjectRepository(GenerationJob) private jobRepo: Repository<GenerationJob>,
    @InjectRepository(GenerationJobItem) private itemRepo: Repository<GenerationJobItem>,
    @InjectRepository(GeneratedImage) private imageRepo: Repository<GeneratedImage>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Reference) private refRepo: Repository<Reference>,
    @InjectRepository(Scene) private sceneRepo: Repository<Scene>,
    @InjectRepository(UserModel) private modelRepo: Repository<UserModel>,
    private storage: StorageService,
    private promptComposer: PromptComposerService,
    private config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ImageJobData>): Promise<any> {
    const data = job.data;
    this.logger.log(`Processing image job ${data.jobId} / item ${data.itemId} — mode: ${data.mode}`);

    try {
      // Update status → generating
      await this.jobRepo.update(data.jobId, { status: JobStatus.GENERATING, progress: 20 });
      await this.itemRepo.update(data.itemId, { status: JobItemStatus.PROCESSING });

      // Fetch entities
      const product = await this.productRepo.findOneOrFail({ where: { id: data.productId } });
      const scene = data.sceneId ? await this.sceneRepo.findOne({ where: { id: data.sceneId } }) : null;
      const reference = data.referenceId ? await this.refRepo.findOne({ where: { id: data.referenceId } }) : null;
      const model = data.modelId ? await this.modelRepo.findOne({ where: { id: data.modelId } }) : null;

      // Get product image as base64
      const productImageUrl = product.originalImageUrl;
      const productBase64 = await this.fetchImageBase64(productImageUrl);

      // Compose prompt
      await this.jobRepo.update(data.jobId, { status: JobStatus.COMPOSING_PROMPT, progress: 30 });

      const composeInput: PromptComposeInput = {
        mode: data.mode,
        productAnalysis: product.analysisJson as any,
        scenePrompt: scene?.prompt,
        referenceAnalysis: reference?.analysisJson as any,
        fusionStrategy: data.referenceStrategy,
        modelDna: model ? (model.dnaJson || {
          gender: model.gender,
          age_range: model.ageRange,
          ethnicity: model.ethnicity,
          skin_tone: model.skinTone,
          hair_color: model.hairColor,
          hair_style: model.hairStyle,
        }) : undefined,
        outputRatio: data.outputRatio,
      };

      const composed = await this.promptComposer.compose(composeInput);

      // Call Gemini for image generation
      await this.jobRepo.update(data.jobId, { status: JobStatus.GENERATING, progress: 50 });

      const parts: any[] = [{ text: composed.promptText }];
      
      // Add product image
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: productBase64 } });

      // Add reference image if present
      if (reference && data.mode === GenerationMode.REFERENCE_FUSION) {
        const refBase64 = await this.fetchImageBase64(reference.originalImageUrl);
        parts.push({ text: '\n\nReference image to guide the style/scene:' });
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: refBase64 } });
      }

      const generatedBase64 = await this.callGeminiImageGeneration(parts, data.imageModelName);

      await this.jobRepo.update(data.jobId, { progress: 80 });

      // Upload result to MinIO
      const outputKey = this.storage.buildKey(data.userId, 'generated', `${randomUUID()}.png`);
      await this.storage.uploadBase64(outputKey, generatedBase64, 'image/png');
      const outputUrl = this.storage.getInternalUrl(outputKey);

      // Save generated image record
      const image = this.imageRepo.create({
        userId: data.userId,
        productId: data.productId,
        referenceId: data.referenceId || null,
        sceneId: data.sceneId || null,
        modelId: data.modelId || null,
        jobId: data.jobId,
        mode: data.mode,
        outputUrl,
        resolution: data.outputRatio || '3:4',
        promptSnapshotJson: {
          promptText: composed.promptText,
          promptVersion: composed.promptVersion,
          blocks: composed.blocks,
          mode: composed.mode,
        },
      });
      const savedImage = await this.imageRepo.save(image);

      // Update job item
      await this.itemRepo.update(data.itemId, {
        status: JobItemStatus.COMPLETED,
        outputImageId: savedImage.id,
      });

      // Update job status
      await this.jobRepo.update(data.jobId, {
        status: JobStatus.QC_CHECK,
        progress: 90,
        promptVersion: composed.promptVersion,
      });

      this.logger.log(`Image generated successfully: ${savedImage.id} for job ${data.jobId}`);
      return { imageId: savedImage.id, outputUrl };

    } catch (error: any) {
      this.logger.error(`Image generation failed for job ${data.jobId}: ${error.message}`);

      await this.itemRepo.update(data.itemId, {
        status: JobItemStatus.FAILED,
        errorMessage: error.message?.substring(0, 500),
      });

      await this.jobRepo.update(data.jobId, {
        status: JobStatus.FAILED,
        errorMessage: error.message?.substring(0, 500),
      });

      throw error; // BullMQ will handle retry
    }
  }

  private async callGeminiImageGeneration(parts: any[], modelName: string): Promise<string> {
    const apiKey = this.config.get<string>('GOOGLE_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.8,
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };

    this.logger.log(`Calling Gemini ${modelName} for image generation...`);
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini image API error ${response.status}: ${errText.substring(0, 300)}`);
    }

    const result = await response.json();
    const elapsed = Date.now() - startTime;
    this.logger.log(`Gemini image generation completed in ${elapsed}ms`);

    // Extract base64 image from response
    const candidate = result?.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error('Gemini returned no content parts');
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return part.inlineData.data;
      }
    }

    throw new Error('Gemini response contained no image data');
  }

  private async fetchImageBase64(imageUrl: string): Promise<string> {
    // If it's a MinIO internal URL, use storage service
    const url = new URL(imageUrl);
    const key = url.pathname.replace(/^\/[^/]+\//, '');
    const signedUrl = await this.storage.getSignedUrl(key);
    const response = await fetch(signedUrl);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
}
