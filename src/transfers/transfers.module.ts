import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { TransferRepository } from './ports/transfer-repository.port';
import { InMemoryTransferRepository } from './adapters/in-memory/in-memory-transfer.repository';
import { PostgresTransferRepository } from './adapters/postgres/postgres-transfer.repository';
import { TransferEventEntity } from './adapters/postgres/transfer-event.entity';

const STORE_DRIVER = process.env.STORE_DRIVER ?? 'postgres';
const usePostgres = STORE_DRIVER === 'postgres';

const repositoryProvider: Provider = usePostgres
  ? { provide: TransferRepository, useClass: PostgresTransferRepository }
  : { provide: TransferRepository, useClass: InMemoryTransferRepository };

@Module({
  imports: [
    ...(usePostgres
      ? [
          TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              type: 'postgres' as const,
              url: config.get<string>('databaseUrl'),
              entities: [TransferEventEntity],
              synchronize: false,
              logging: false,
            }),
          }),
          TypeOrmModule.forFeature([TransferEventEntity]),
        ]
      : []),
  ],
  controllers: [TransfersController],
  providers: [TransfersService, repositoryProvider],
  exports: [TransferRepository],
})
export class TransfersModule {}
