import { Module, Global, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../common/enums';

const logger = new Logger('QueueModule');

@Global()
@Module({
  imports: [
    // Redis connection
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST') || 'localhost';
        const port = parseInt(config.get<string>('REDIS_PORT') || '6379', 10);
        logger.log(`BullMQ connecting to Redis at ${host}:${port}`);
        return {
          connection: {
            host,
            port,
            password: config.get<string>('REDIS_PASSWORD') || undefined,
            maxRetriesPerRequest: null,
            retryStrategy: (times: number) => {
              if (times > 3) {
                logger.warn(`Redis connection failed after ${times} attempts — queues will be unavailable`);
                return null; // stop retrying
              }
              return Math.min(times * 500, 3000);
            },
          },
        };
      },
    }),

    // Register queues
    BullModule.registerQueue(
      { name: QUEUE_NAMES.ANALYSIS },
      { name: QUEUE_NAMES.IMAGE_GENERATION },
      { name: QUEUE_NAMES.VIDEO_GENERATION },
      { name: QUEUE_NAMES.QC },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
