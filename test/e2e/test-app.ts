import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

/**
 * Boots a Nest app for e2e tests with the SAME global pipes/filters as main.ts,
 * so tests exercise the real validation + error envelope behaviour.
 *
 * STORE_DRIVER is read at module-evaluation time in TransfersModule, so we set
 * it BEFORE dynamically importing AppModule (and reset the module registry to
 * pick up the change between drivers).
 */
export async function createTestApp(driver: 'memory' | 'postgres'): Promise<INestApplication> {
  process.env.STORE_DRIVER = driver;
  if (driver === 'memory') {
    delete process.env.DATABASE_URL;
  }

  jest.resetModules();
  const { AppModule } = await import('../../src/app.module');
  const { AllExceptionsFilter } = await import('../../src/common/all-exceptions.filter');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return app;
}
