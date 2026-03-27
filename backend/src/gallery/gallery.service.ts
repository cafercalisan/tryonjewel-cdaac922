import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeneratedImage } from '../entities/generated-image.entity';
import { StorageService } from '../storage/storage.service';
import { GenerationMode } from '../common/enums';

export interface GalleryFilters {
  productId?: string;
  mode?: GenerationMode;
  modelId?: string;
  sceneId?: string;
  referenceId?: string;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  constructor(
    @InjectRepository(GeneratedImage) private imageRepo: Repository<GeneratedImage>,
    private storage: StorageService,
  ) {}

  async listImages(userId: string, filters: GalleryFilters = {}): Promise<{ items: any[]; total: number }> {
    const qb = this.imageRepo
      .createQueryBuilder('img')
      .where('img.user_id = :userId', { userId })
      .orderBy('img.created_at', 'DESC');

    if (filters.productId) qb.andWhere('img.product_id = :productId', { productId: filters.productId });
    if (filters.mode) qb.andWhere('img.mode = :mode', { mode: filters.mode });
    if (filters.modelId) qb.andWhere('img.model_id = :modelId', { modelId: filters.modelId });
    if (filters.sceneId) qb.andWhere('img.scene_id = :sceneId', { sceneId: filters.sceneId });
    if (filters.referenceId) qb.andWhere('img.reference_id = :referenceId', { referenceId: filters.referenceId });
    if (filters.isFavorite !== undefined) qb.andWhere('img.is_favorite = :fav', { fav: filters.isFavorite });

    const total = await qb.getCount();
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const images = await qb.skip(offset).take(limit).getMany();

    // Generate signed URLs for display
    const items = await Promise.all(
      images.map(async (img) => {
        let signedUrl: string | null = null;
        try {
          const url = new URL(img.outputUrl);
          const key = url.pathname.replace(/^\/[^/]+\//, '');
          signedUrl = await this.storage.getSignedUrl(key, 7200);
        } catch {}

        return {
          id: img.id,
          mode: img.mode,
          imageType: img.imageType,
          outputUrl: signedUrl || img.outputUrl,
          productId: img.productId,
          sceneId: img.sceneId,
          referenceId: img.referenceId,
          modelId: img.modelId,
          qcScore: img.qcScore,
          qcVerdict: img.qcVerdict,
          isFavorite: img.isFavorite,
          createdAt: img.createdAt,
        };
      }),
    );

    return { items, total };
  }

  async toggleFavorite(imageId: string, userId: string): Promise<boolean> {
    const image = await this.imageRepo.findOne({ where: { id: imageId, userId } });
    if (!image) return false;
    await this.imageRepo.update(imageId, { isFavorite: !image.isFavorite });
    return !image.isFavorite;
  }
}
