import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { ProductsService } from './products.service';
import { UploadProductDto } from './dto/upload-product.dto';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post('upload')
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadProductDto,
  ) {
    const product = await this.productsService.uploadProduct(user.id, dto);
    return {
      data: {
        id: product.id,
        status: product.status,
        originalImageUrl: product.originalImageUrl,
        createdAt: product.createdAt,
      },
    };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const products = await this.productsService.findAllByUser(user.id);
    return { data: products };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const product = await this.productsService.findOne(id, user.id);
    return { data: product };
  }

  @Get(':id/signed-url')
  async getSignedUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const product = await this.productsService.findOne(id, user.id);
    const url = await this.productsService.getSignedUrl(product);
    return { data: { url } };
  }
}
