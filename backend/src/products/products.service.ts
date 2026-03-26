import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { StorageService } from '../storage/storage.service';
import { UploadProductDto } from './dto/upload-product.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private storage: StorageService,
  ) {}

  async uploadProduct(userId: string, dto: UploadProductDto): Promise<Product> {
    const ext = dto.contentType?.includes('png') ? 'png' : 'jpg';
    const filename = dto.filename || `${randomUUID()}.${ext}`;
    const key = this.storage.buildKey(userId, 'products', filename);

    // Upload to MinIO
    await this.storage.uploadBase64(key, dto.imageBase64, dto.contentType || 'image/jpeg');
    const imageUrl = this.storage.getInternalUrl(key);

    this.logger.log(`Product uploaded: ${key}`);

    // Create DB record
    const product = this.productRepo.create({
      userId,
      originalImageUrl: imageUrl,
      productType: dto.productType || null,
      setGroupId: dto.setGroupId || null,
      status: 'uploaded',
    });

    return this.productRepo.save(product);
  }

  async findAllByUser(userId: string): Promise<Product[]> {
    return this.productRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id, userId } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async updateAnalysis(id: string, analysisData: {
    productType?: any;
    metalColor?: any;
    dominantShape?: string;
    stonePresence?: boolean;
    stoneLayoutSummary?: string;
    complexityScore?: number;
    analysisJson: Record<string, any>;
  }): Promise<Product> {
    await this.productRepo.update(id, {
      ...(analysisData as any),
      status: 'analyzed',
    });
    return this.productRepo.findOneOrFail({ where: { id } });
  }

  async getSignedUrl(product: Product): Promise<string> {
    // Extract key from internal URL
    const url = new URL(product.originalImageUrl);
    const key = url.pathname.replace(/^\/[^/]+\//, ''); // remove bucket prefix
    return this.storage.getSignedUrl(key);
  }

  async getImageBase64(product: Product): Promise<string> {
    const signedUrl = await this.getSignedUrl(product);
    const response = await fetch(signedUrl);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
}
