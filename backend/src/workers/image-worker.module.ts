import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationJob } from '../entities/generation-job.entity';
import { GenerationJobItem } from '../entities/generation-job-item.entity';
import { GeneratedImage } from '../entities/generated-image.entity';
import { Product } from '../entities/product.entity';
import { Reference } from '../entities/reference.entity';
import { Scene } from '../entities/scene.entity';
import { UserModel } from '../entities/user-model.entity';
import { ImageWorker } from './image.worker';
import { PromptModule } from '../prompt/prompt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GenerationJob,
      GenerationJobItem,
      GeneratedImage,
      Product,
      Reference,
      Scene,
      UserModel,
    ]),
    PromptModule,
  ],
  providers: [ImageWorker],
  exports: [ImageWorker],
})
export class ImageWorkerModule {}
