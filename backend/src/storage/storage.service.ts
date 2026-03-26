import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client;
  private bucket: string;
  private endpoint: string;

  constructor(private config: ConfigService) {
    this.endpoint = this.config.get<string>('MINIO_ENDPOINT') || 'http://localhost:9000';
    this.bucket = this.config.get<string>('MINIO_BUCKET') || 'tryonjewel';

    this.s3 = new S3Client({
      endpoint: this.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('MINIO_ACCESS_KEY') || 'minioadmin',
        secretAccessKey: this.config.get<string>('MINIO_SECRET_KEY') || 'minioadmin',
      },
    });
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Storage bucket "${this.bucket}" OK`);
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created storage bucket "${this.bucket}"`);
      } catch (err: any) {
        this.logger.warn(`Storage bucket check/create failed: ${err.message}`);
      }
    }
  }

  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async uploadBase64(key: string, base64Data: string, contentType = 'image/png'): Promise<string> {
    const buffer = Buffer.from(base64Data, 'base64');
    return this.uploadFile(key, buffer, contentType);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /** Build the internal URL for a stored file (used in DB records) */
  getInternalUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  /** Generate a storage key with user/type/date structure */
  buildKey(userId: string, assetType: string, filename: string): string {
    const date = new Date().toISOString().slice(0, 10);
    return `${userId}/${assetType}/${date}/${filename}`;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
