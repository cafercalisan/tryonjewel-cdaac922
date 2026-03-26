import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratedImage } from '../entities/generated-image.entity';
import { GenerationJob } from '../entities/generation-job.entity';
import { QCReport } from '../entities/qc-report.entity';
import { QCWorker } from './qc.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([GeneratedImage, GenerationJob, QCReport]),
  ],
  providers: [QCWorker],
  exports: [QCWorker],
})
export class QCWorkerModule {}
