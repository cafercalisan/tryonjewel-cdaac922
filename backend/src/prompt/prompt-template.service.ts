import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptTemplate } from '../entities/prompt-template.entity';
import { GenerationMode } from '../common/enums';

@Injectable()
export class PromptTemplateService {
  private readonly logger = new Logger(PromptTemplateService.name);

  constructor(
    @InjectRepository(PromptTemplate) private repo: Repository<PromptTemplate>,
  ) {}

  async findActive(mode: GenerationMode): Promise<PromptTemplate | null> {
    return this.repo.findOne({
      where: { mode, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(mode?: GenerationMode): Promise<PromptTemplate[]> {
    const where = mode ? { mode } : {};
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async create(data: Partial<PromptTemplate>): Promise<PromptTemplate> {
    const template = this.repo.create(data);
    return this.repo.save(template);
  }

  async update(id: string, data: Partial<PromptTemplate>): Promise<PromptTemplate> {
    await this.repo.update(id, data);
    return this.repo.findOneOrFail({ where: { id } });
  }

  /** Seed initial templates if none exist */
  async seedIfEmpty(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) {
      this.logger.log(`Prompt templates already seeded (${count} found)`);
      return;
    }

    this.logger.log('Seeding initial prompt templates...');

    const modes = [
      GenerationMode.RETOUCH,
      GenerationMode.READY_SCENE,
      GenerationMode.REFERENCE_FUSION,
      GenerationMode.MODEL_SHOWCASE,
      GenerationMode.EXPERIENCE,
    ];

    for (const mode of modes) {
      await this.repo.save(
        this.repo.create({
          mode,
          version: 'seed-v1',
          templateJson: {
            description: `Default template for ${mode} mode`,
            blocks: ['task', 'fidelity', 'scene', 'reference', 'identity', 'camera', 'lighting', 'styling', 'negative'],
          },
          imageModelName: mode === GenerationMode.RETOUCH || mode === GenerationMode.READY_SCENE
            ? 'gemini-3.1-flash-image-preview'
            : 'gemini-3-pro-image-preview',
          isActive: true,
        }),
      );
    }

    this.logger.log(`Seeded ${modes.length} prompt templates`);
  }
}
