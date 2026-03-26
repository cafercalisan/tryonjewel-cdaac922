import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

// Existing entities
import { User } from '../entities/user.entity';
import { Profile } from '../entities/profile.entity';
import { UserRole } from '../entities/user-role.entity';
import { Scene } from '../entities/scene.entity';

// New entities (PRD)
import { Product } from '../entities/product.entity';
import { Reference } from '../entities/reference.entity';
import { ProductSet } from '../entities/product-set.entity';
import { GenerationJob } from '../entities/generation-job.entity';
import { GenerationJobItem } from '../entities/generation-job-item.entity';
import { GeneratedImage } from '../entities/generated-image.entity';
import { Video } from '../entities/video.entity';
import { QCReport } from '../entities/qc-report.entity';
import { PromptTemplate } from '../entities/prompt-template.entity';
import { UserModel } from '../entities/user-model.entity';

const entities = [
  User, Profile, UserRole, Scene,
  Product, Reference, ProductSet,
  GenerationJob, GenerationJobItem,
  GeneratedImage, Video,
  QCReport, PromptTemplate, UserModel,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities,
        synchronize: false, // Always use migrations
        logging: config.get('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
