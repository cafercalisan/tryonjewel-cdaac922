import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { GalleryService, GalleryFilters } from './gallery.service';
import { GenerationMode } from '../common/enums';

@Controller('gallery')
@UseGuards(JwtAuthGuard)
export class GalleryController {
  constructor(private galleryService: GalleryService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('productId') productId?: string,
    @Query('mode') mode?: GenerationMode,
    @Query('modelId') modelId?: string,
    @Query('sceneId') sceneId?: string,
    @Query('referenceId') referenceId?: string,
    @Query('favorites') favorites?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters: GalleryFilters = {
      productId,
      mode,
      modelId,
      sceneId,
      referenceId,
      isFavorite: favorites === 'true' ? true : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    };

    const result = await this.galleryService.listImages(user.id, filters);
    return { data: result };
  }

  @Post(':imageId/favorite')
  async toggleFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('imageId') imageId: string,
  ) {
    const isFavorite = await this.galleryService.toggleFavorite(imageId, user.id);
    return { data: { isFavorite } };
  }
}
