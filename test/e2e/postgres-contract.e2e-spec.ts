import { DataSource } from 'typeorm';
import { PostgresTransferRepository } from '../../src/transfers/adapters/postgres/postgres-transfer.repository';
import { TransferEventEntity } from '../../src/transfers/adapters/postgres/transfer-event.entity';
import { runRepositoryContract } from '../contract/transfer-repository.contract';
import { describePostgres, makeTestDataSource, truncate } from './postgres-harness';

/**
 * Runs the EXACT SAME contract suite as the in-memory adapter, but against a
 * real Postgres. If the two adapters ever diverge, this fails — Liskov enforced.
 */
let ds: DataSource;

describePostgres('Postgres adapter contract', () => {
  beforeAll(async () => {
    ds = await makeTestDataSource();
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  runRepositoryContract('Postgres', {
    makeRepo: async () => new PostgresTransferRepository(ds.getRepository(TransferEventEntity)),
    reset: async () => {
      await truncate(ds);
    },
  });
});
