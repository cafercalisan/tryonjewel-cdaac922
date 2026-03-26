import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptTemplate } from '../entities/prompt-template.entity';
import { PromptComposerService } from './prompt-composer.service';
import { PromptTemplateService } from './prompt-template.service';
import { PromptController } from './prompt.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PromptTemplate])],
  controllers: [PromptController],
  providers: [PromptComposerService, PromptTemplateService],
  exports: [PromptComposerService, PromptTemplateService],
})
export class PromptModule implements OnModuleInit {
  private readonly logger = new Logger(PromptModule.name);

  constructor(private templateService: PromptTemplateService) {}

  async onModuleInit() {
    try {
      await this.templateService.seedIfEmpty();
    } catch (err: any) {
      this.logger.warn(`Prompt template seed skipped: ${err.message?.substring(0, 100)}`);
    }
  }
}
