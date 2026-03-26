import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { GenerationService } from './generation.service';
import { CreateGenerationDto } from './dto/create-generation.dto';

@Controller('generations')
@UseGuards(JwtAuthGuard)
export class GenerationController {
  constructor(private generationService: GenerationService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGenerationDto,
  ) {
    const job = await this.generationService.createJob(user.id, dto);
    return {
      data: {
        jobId: job.id,
        status: job.status,
        mode: job.jobMode,
      },
    };
  }

  @Get(':jobId')
  async getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    const status = await this.generationService.getJobStatus(jobId, user.id);
    if (!status) return { data: null, error: 'Job not found' };
    return { data: status };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const jobs = await this.generationService.listJobs(user.id);
    return { data: jobs };
  }
}
