import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Quiet by default: drop verbose/debug; keep log/warn/error.
    logger: ['log', 'warn', 'error'],
  });

  // Security headers.
  app.use(helmet());

  // Request body size limit — second DoS guard alongside MAX_BATCH_SIZE.
  app.use(express.json({ limit: '5mb' }));

  // Global validation: strip unknown fields, transform payloads into DTO
  // instances, and reject the whole batch on any shape error (fail-fast).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // One consistent error envelope for everything.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Graceful shutdown (drains connections, closes the DB pool) on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // OpenAPI as the single source of API truth — generated from the DTOs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Station Transfer Reconciliation API')
    .setDescription('Idempotent, concurrency-safe ingestion + per-station reconciliation.')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  new Logger('Bootstrap').log(
    `API listening on :${port} (store=${process.env.STORE_DRIVER ?? 'postgres'}) — docs at /docs`,
  );
}

bootstrap();
