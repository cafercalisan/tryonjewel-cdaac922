import { Module, OnModuleInit } from '@nestjs/common';
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
  constructor(private templateService: PromptTemplateService) {}

  async onModuleInit() {
    await this.templateService.seedIfEmpty();
  }
}
