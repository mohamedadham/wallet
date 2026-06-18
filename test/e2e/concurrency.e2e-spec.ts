import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp } from './test-app';
import { describePostgres, postgresAvailable, TEST_DATABASE_URL } from './postgres-harness';

/**
 * THE headline test (test 4). Fire N parallel POSTs all carrying the same
 * event_id at a Postgres-backed app and assert:
 *   - summed `inserted` across all responses === exactly 1
 *   - the station summary counts that event exactly once
 *
 * This runs against a REAL database on purpose: the no-double-insert guarantee
 * is provided by the UNIQUE constraint, so a mock would prove nothing.
 */
describePostgres('Concurrency (e2e, Postgres)', () => {
  let app: INestApplication;
  let http: request.Agent;
  let ds: DataSource;

  beforeAll(async () => {
    // Ensure the app boots in postgres mode against the test DB.
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    app = await createTestApp('postgres');
    http = request(app.getHttpServer()) as unknown as request.Agent;

    ds = app.get<DataSource>(getDataSourceToken());
    await ds.runMigrations();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    if (postgresAvailable) await ds.query('TRUNCATE TABLE "transfer_events"');
  });

  it('does not double-insert under concurrent POSTs of the same event_id', async () => {
    const N = 25;
    const body = {
      events: [
        {
          event_id: 'race_evt',
          station_id: 'S_RACE',
          amount: '100.00',
          status: 'approved',
          created_at: '2026-02-19T10:00:00Z',
        },
      ],
    };

    const responses = await Promise.all(
      Array.from({ length: N }, () => http.post('/transfers').send(body)),
    );

    responses.forEach((r) => expect(r.status).toBe(200));

    const totalInserted = responses.reduce((sum, r) => sum + r.body.inserted, 0);
    const totalDuplicates = responses.reduce((sum, r) => sum + r.body.duplicates, 0);

    expect(totalInserted).toBe(1); // exactly one writer won
    expect(totalDuplicates).toBe(N - 1); // everyone else saw a duplicate

    const summary = await http.get('/stations/S_RACE/summary').expect(200);
    expect(summary.body.events_count).toBe(1); // counted once
    expect(summary.body.total_approved_amount).toBe('100.00'); // totals consistent
  });

  it('keeps totals consistent under concurrent batches with overlapping ids', async () => {
    const mkBatch = (ids: string[]) => ({
      events: ids.map((id) => ({
        event_id: id,
        station_id: 'S_RACE2',
        amount: '10.00',
        status: 'approved',
        created_at: '2026-02-19T10:00:00Z',
      })),
    });

    // Overlapping batches: union of distinct ids is {a,b,c,d}.
    await Promise.all([
      http.post('/transfers').send(mkBatch(['a', 'b', 'c'])),
      http.post('/transfers').send(mkBatch(['b', 'c', 'd'])),
      http.post('/transfers').send(mkBatch(['a', 'd'])),
    ]);

    const summary = await http.get('/stations/S_RACE2/summary').expect(200);
    expect(summary.body.events_count).toBe(4); // a,b,c,d once each
    expect(summary.body.total_approved_amount).toBe('40.00');
  });
});
