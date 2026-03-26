import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { ReferencesService } from './references.service';
import { UploadReferenceDto } from './dto/upload-reference.dto';

@Controller('references')
@UseGuards(JwtAuthGuard)
export class ReferencesController {
  constructor(private referencesService: ReferencesService) {}

  @Post('upload')
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadReferenceDto,
  ) {
    const reference = await this.referencesService.uploadReference(user.id, dto);
    return {
      data: {
        id: reference.id,
        status: reference.status,
        referenceType: reference.referenceType,
        createdAt: reference.createdAt,
      },
    };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const references = await this.referencesService.findAllByUser(user.id);
    return { data: references };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const reference = await this.referencesService.findOne(id, user.id);
    return { data: reference };
  }
}
