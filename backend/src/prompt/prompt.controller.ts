import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { PromptTemplateService } from './prompt-template.service';
import { GenerationMode } from '../common/enums';

@Controller('prompt-templates')
export class PromptController {
  constructor(private templateService: PromptTemplateService) {}

  @Get()
  async list(@Query('mode') mode?: GenerationMode) {
    const templates = await this.templateService.findAll(mode);
    return { data: templates };
  }

  @Post()
  async create(@Body() body: any) {
    const template = await this.templateService.create(body);
    return { data: template };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const template = await this.templateService.update(id, body);
    return { data: template };
  }
}
