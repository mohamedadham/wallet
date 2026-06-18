import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { TransfersModule } from './transfers/transfers.module';
import { HealthModule } from './health/health.module';
import { RequestIdMiddleware } from './common/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Boot-time env validation: the app refuses to start on missing/invalid
      // config (e.g. no DATABASE_URL in postgres mode).
      validate: validateEnv,
    }),
    TransfersModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Attach a correlation id to every request; the exception filter logs it.
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
