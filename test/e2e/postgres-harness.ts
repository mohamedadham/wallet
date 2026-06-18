import { DataSource } from 'typeorm';
import { TransferEventEntity } from '../../src/transfers/adapters/postgres/transfer-event.entity';
import { CreateTransferEvents1718600000000 } from '../../src/transfers/adapters/postgres/migrations/1718600000000-CreateTransferEvents';

/**
 * Postgres is OPTIONAL for the test run: if no DATABASE_URL/TEST_DATABASE_URL is
 * configured, the DB-backed specs skip rather than fail, so `npm test` is green
 * on a laptop with no database. CI / `docker compose run app test` provide the URL.
 *
 * We deliberately do NOT mock the database: the concurrency guarantee lives in
 * the UNIQUE constraint, so mocking it would prove nothing.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
export const postgresAvailable = !!TEST_DATABASE_URL;

export function describePostgres(name: string, fn: () => void): void {
  (postgresAvailable ? describe : describe.skip)(name, fn);
}

export async function makeTestDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    url: TEST_DATABASE_URL,
    entities: [TransferEventEntity],
    migrations: [CreateTransferEvents1718600000000],
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  await ds.runMigrations(); // idempotent: TypeORM skips already-applied migrations
  return ds;
}

export async function truncate(ds: DataSource): Promise<void> {
  await ds.query('TRUNCATE TABLE "transfer_events"');
}
