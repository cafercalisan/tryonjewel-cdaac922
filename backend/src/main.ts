import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Global prefix for v2 API
  app.setGlobalPrefix('api/v2');

  // CORS — allow all for now (frontend on different port)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'authorization,x-client-info,apikey,content-type',
  });

  // Body size limit
  app.use(json({ limit: '50mb' }));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.API_V2_PORT || process.env.API_PORT || 3002;
  await app.listen(port);
  logger.log(`TryOnJewel API v2 running on port ${port}`);
  logger.log(`Health: http://localhost:${port}/api/v2/health`);
}

bootstrap();
