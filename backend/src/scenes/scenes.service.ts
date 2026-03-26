import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scene } from '../entities/scene.entity';

@Injectable()
export class ScenesService {
  constructor(
    @InjectRepository(Scene) private sceneRepo: Repository<Scene>,
  ) {}

  async findAll(category?: string): Promise<Scene[]> {
    const where = category ? { category } : {};
    return this.sceneRepo.find({ where, order: { sortOrder: 'ASC' } });
  }

  async findOne(id: string): Promise<Scene | null> {
    return this.sceneRepo.findOne({ where: { id } });
  }

  async findByMode(mode: string): Promise<Scene[]> {
    // Map generation mode to scene categories
    const categoryMap: Record<string, string[]> = {
      retouch: ['ecommerce'],
      ready_scene: ['editorial', 'ecommerce', 'macro', 'lifestyle'],
      reference_fusion: ['editorial', 'lifestyle'],
      model_showcase: ['model', 'closeup'],
      experience: ['lifestyle', 'editorial'],
    };
    const categories = categoryMap[mode] || ['editorial'];
    
    return this.sceneRepo
      .createQueryBuilder('scene')
      .where('scene.category IN (:...categories)', { categories })
      .orderBy('scene.sort_order', 'ASC')
      .getMany();
  }
}
