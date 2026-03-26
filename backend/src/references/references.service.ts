import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reference } from '../entities/reference.entity';
import { StorageService } from '../storage/storage.service';
import { UploadReferenceDto } from './dto/upload-reference.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ReferencesService {
  private readonly logger = new Logger(ReferencesService.name);

  constructor(
    @InjectRepository(Reference) private refRepo: Repository<Reference>,
    private storage: StorageService,
  ) {}

  async uploadReference(userId: string, dto: UploadReferenceDto): Promise<Reference> {
    const ext = dto.contentType?.includes('png') ? 'png' : 'jpg';
    const filename = dto.filename || `${randomUUID()}.${ext}`;
    const key = this.storage.buildKey(userId, 'references', filename);

    await this.storage.uploadBase64(key, dto.imageBase64, dto.contentType || 'image/jpeg');
    const imageUrl = this.storage.getInternalUrl(key);

    this.logger.log(`Reference uploaded: ${key}`);

    const reference = this.refRepo.create({
      userId,
      originalImageUrl: imageUrl,
      referenceType: dto.referenceType || null,
      status: 'uploaded',
    });

    return this.refRepo.save(reference);
  }

  async findAllByUser(userId: string): Promise<Reference[]> {
    return this.refRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Reference> {
    const ref = await this.refRepo.findOne({ where: { id, userId } });
    if (!ref) throw new NotFoundException(`Reference ${id} not found`);
    return ref;
  }

  async updateAnalysis(id: string, data: Partial<Reference>): Promise<Reference> {
    await this.refRepo.update(id, {
      ...data,
      status: 'analyzed',
    });
    return this.refRepo.findOneOrFail({ where: { id } });
  }

  async getImageBase64(reference: Reference): Promise<string> {
    const url = new URL(reference.originalImageUrl);
    const key = url.pathname.replace(/^\/[^/]+\//, '');
    const signedUrl = await this.storage.getSignedUrl(key);
    const response = await fetch(signedUrl);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
}
