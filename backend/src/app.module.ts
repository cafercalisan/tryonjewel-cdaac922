import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { HealthModule } from './health/health.module';
import { ProductsModule } from './products/products.module';
import { ReferencesModule } from './references/references.module';
import { AnalysisModule } from './analysis/analysis.module';
import { PromptModule } from './prompt/prompt.module';
import { ScenesModule } from './scenes/scenes.module';
import { GenerationModule } from './generation/generation.module';
import { ImageWorkerModule } from './workers/image-worker.module';
import { QCWorkerModule } from './workers/qc-worker.module';
import { GalleryModule } from './gallery/gallery.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '../.env.production'],
    }),

    // Core infrastructure
    DatabaseModule,
    AuthModule,
    StorageModule,
    QueueModule,
    HealthModule,

    // Feature modules
    ProductsModule,
    ReferencesModule,
    AnalysisModule,
    PromptModule,
    ScenesModule,
    GenerationModule,
    ImageWorkerModule,
    QCWorkerModule,
    GalleryModule,
  ],
})
export class AppModule {}
