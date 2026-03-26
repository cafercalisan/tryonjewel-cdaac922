import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationJob } from '../entities/generation-job.entity';
import { GenerationJobItem } from '../entities/generation-job-item.entity';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { ProductsModule } from '../products/products.module';
import { ScenesModule } from '../scenes/scenes.module';
import { ReferencesModule } from '../references/references.module';
import { ImageWorkerModule } from '../workers/image-worker.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GenerationJob, GenerationJobItem]),
    ProductsModule,
    ScenesModule,
    ReferencesModule,
    ImageWorkerModule,
  ],
  controllers: [GenerationController],
  providers: [GenerationService],
  exports: [GenerationService],
})
export class GenerationModule {}
