import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';

/**
 * HTTP-level behaviour, run against the in-memory store so it needs no database.
 * Covers the documented fail-fast validation choice (test 6) and the summary
 * endpoint shape (test 5), plus the idempotent resend example from the README.
 */
describe('Transfers API (e2e, in-memory)', () => {
  let app: INestApplication;
  let http: request.Agent;

  beforeAll(async () => {
    app = await createTestApp('memory');
    http = request(app.getHttpServer()) as unknown as request.Agent;
  });

  afterAll(async () => {
    await app.close();
  });

  const evt = (over: Record<string, unknown> = {}) => ({
    event_id: 'evt_1',
    station_id: 'S1',
    amount: 100.5,
    status: 'approved',
    created_at: '2026-02-19T10:00:00Z',
    ...over,
  });

  it('ingests a valid batch and returns inserted/duplicates', async () => {
    const res = await http
      .post('/transfers')
      .send({ events: [evt({ event_id: 'v1' }), evt({ event_id: 'v2' })] })
      .expect(200);
    expect(res.body).toEqual({ inserted: 2, duplicates: 0 });
  });

  it('is idempotent: re-sending a stored event returns inserted:0', async () => {
    await http
      .post('/transfers')
      .send({ events: [evt({ event_id: 'dup1' })] })
      .expect(200);
    const res = await http
      .post('/transfers')
      .send({ events: [evt({ event_id: 'dup1' })] })
      .expect(200);
    expect(res.body).toEqual({ inserted: 0, duplicates: 1 });
  });

  it('rejects the WHOLE batch with 400 if any event is invalid (fail-fast), persisting nothing', async () => {
    const res = await http
      .post('/transfers')
      .send({
        events: [
          evt({ event_id: 'good_in_bad_batch', station_id: 'S_FAILFAST' }),
          evt({ event_id: 'bad', amount: -5 }), // negative amount -> invalid
        ],
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toBeDefined();

    // Nothing from the rejected batch was persisted.
    const summary = await http.get('/stations/S_FAILFAST/summary').expect(200);
    expect(summary.body.events_count).toBe(0);
  });

  it('rejects a non-ISO8601 created_at', async () => {
    await http
      .post('/transfers')
      .send({ events: [evt({ event_id: 'baddate', created_at: 'not-a-date' })] })
      .expect(400);
  });

  it('rejects an empty events array', async () => {
    await http.post('/transfers').send({ events: [] }).expect(400);
  });

  it('rejects unknown fields (forbidNonWhitelisted) with 400', async () => {
    const res = await http
      .post('/transfers')
      .send({ events: [evt({ event_id: 'wl1', sneaky: 'dropme' })] })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('summary sums approved only, counts all statuses, and is order-independent', async () => {
    const station = 'S_SUMMARY';
    // Insert out of order, mixed statuses.
    await http
      .post('/transfers')
      .send({
        events: [
          {
            event_id: 's1',
            station_id: station,
            amount: '30.00',
            status: 'approved',
            created_at: '2026-02-19T12:00:00Z',
          },
          {
            event_id: 's2',
            station_id: station,
            amount: '20.25',
            status: 'approved',
            created_at: '2026-02-19T08:00:00Z',
          },
          {
            event_id: 's3',
            station_id: station,
            amount: '999.00',
            status: 'declined',
            created_at: '2026-02-19T10:00:00Z',
          },
        ],
      })
      .expect(200);

    const res = await http.get(`/stations/${station}/summary`).expect(200);
    expect(res.body).toEqual({
      station_id: station,
      total_approved_amount: '50.25',
      events_count: 3,
    });
  });

  it('returns zeros for an unknown station (200, not 404)', async () => {
    const res = await http.get('/stations/unknown-station/summary').expect(200);
    expect(res.body).toEqual({
      station_id: 'unknown-station',
      total_approved_amount: '0.00',
      events_count: 0,
    });
  });
});
