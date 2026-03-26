import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StorageService } from '../storage/storage.service';
import { QUEUE_NAMES } from '../common/enums';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectQueue(QUEUE_NAMES.ANALYSIS) private analysisQueue: Queue,
    private storage: StorageService,
  ) {}

  async check() {
    const [db, redis, minio] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.storage.isHealthy(),
    ]);

    const healthy = db && redis && minio;

    return {
      status: healthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: { db, redis, minio },
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (err: any) {
      this.logger.error(`DB health check failed: ${err.message}`);
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      // BullMQ queue client is connected if we can call getJobCounts
      await this.analysisQueue.getJobCounts();
      return true;
    } catch (err: any) {
      this.logger.error(`Redis health check failed: ${err.message}`);
      return false;
    }
  }
}
