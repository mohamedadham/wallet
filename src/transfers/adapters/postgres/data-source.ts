import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { TransferEventEntity } from './transfer-event.entity';
import { CreateTransferEvents1718600000000 } from './migrations/1718600000000-CreateTransferEvents';

// Loaded for the TypeORM CLI (migration:run / migration:revert) outside Nest.
dotenv.config();

/**
 * Standalone DataSource for the TypeORM CLI. `synchronize` is OFF — schema
 * changes only ever happen through the migrations listed here.
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [TransferEventEntity],
  migrations: [CreateTransferEvents1718600000000],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
