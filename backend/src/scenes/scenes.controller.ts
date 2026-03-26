import { Controller, Get, Query } from '@nestjs/common';
import { ScenesService } from './scenes.service';

@Controller('scenes')
export class ScenesController {
  constructor(private scenesService: ScenesService) {}

  @Get()
  async list(@Query('category') category?: string, @Query('mode') mode?: string) {
    if (mode) {
      const scenes = await this.scenesService.findByMode(mode);
      return { data: scenes };
    }
    const scenes = await this.scenesService.findAll(category);
    return { data: scenes };
  }
}
