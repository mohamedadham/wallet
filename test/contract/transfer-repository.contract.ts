import { TransferRepository } from '../../src/transfers/ports/transfer-repository.port';
import { TransferEvent } from '../../src/transfers/domain/transfer-event';

/**
 * The shared contract suite for the TransferRepository PORT.
 *
 * It is run TWICE — once against the in-memory adapter, once against Postgres —
 * from two thin spec files. If the two adapters ever disagree, one of these
 * assertions fails. That is Liskov enforced by tests rather than by hope.
 *
 * `makeRepo` returns a fresh, empty repository for each test; `teardown` lets
 * the Postgres runner close its connection.
 */
export interface ContractHarness {
  makeRepo: () => Promise<TransferRepository>;
  reset: () => Promise<void>;
  teardown?: () => Promise<void>;
}

const ev = (over: Partial<TransferEvent> = {}): TransferEvent => ({
  eventId: 'evt_1',
  stationId: 'S1',
  amount: '100.00',
  status: 'approved',
  createdAt: new Date('2026-02-19T10:00:00Z'),
  ...over,
});

export function runRepositoryContract(name: string, harness: ContractHarness): void {
  describe(`TransferRepository contract: ${name}`, () => {
    let repo: TransferRepository;

    beforeEach(async () => {
      await harness.reset();
      repo = await harness.makeRepo();
    });

    afterAll(async () => {
      await harness.teardown?.();
    });

    // Test 1 — counting logic (in-batch dedup is handled by the service, so the
    // port sees unique ids; here we verify "already stored" counting).
    it('reports correct inserted/duplicates across calls', async () => {
      const first = await repo.insertNewEvents([
        ev({ eventId: 'a' }),
        ev({ eventId: 'b' }),
        ev({ eventId: 'c' }),
      ]);
      expect(first).toEqual({ inserted: 3, duplicates: 0 });

      const second = await repo.insertNewEvents([
        ev({ eventId: 'b' }), // already stored
        ev({ eventId: 'c' }), // already stored
        ev({ eventId: 'd' }), // new
      ]);
      expect(second).toEqual({ inserted: 1, duplicates: 2 });
    });

    // Test 2 — re-sending a stored event never changes totals (idempotency).
    it('re-sending a stored event does not change totals', async () => {
      await repo.insertNewEvents([ev({ eventId: 'a', amount: '100.00' })]);
      const before = await repo.getStationSummary('S1');

      await repo.insertNewEvents([ev({ eventId: 'a', amount: '999.99' })]); // same id, must NOT overwrite
      const after = await repo.getStationSummary('S1');

      expect(after).toEqual(before);
      expect(after.totalApprovedAmount).toBe('100.00');
      expect(after.eventsCount).toBe(1);
    });

    // Test 3 — out-of-order arrival yields identical totals (aggregation is
    // order-independent by construction).
    it('produces identical totals regardless of arrival order', async () => {
      const a = ev({ eventId: 'a', amount: '10.00', createdAt: new Date('2026-02-19T12:00:00Z') });
      const b = ev({ eventId: 'b', amount: '20.00', createdAt: new Date('2026-02-19T08:00:00Z') });
      const c = ev({ eventId: 'c', amount: '30.00', createdAt: new Date('2026-02-19T10:00:00Z') });

      await repo.insertNewEvents([a, b, c]);
      const forward = await repo.getStationSummary('S1');

      await harness.reset();
      const repo2 = await harness.makeRepo();
      await repo2.insertNewEvents([c, a, b]); // different order
      const shuffled = await repo2.getStationSummary('S1');

      expect(shuffled.totalApprovedAmount).toBe(forward.totalApprovedAmount);
      expect(shuffled.eventsCount).toBe(forward.eventsCount);
      expect(forward.totalApprovedAmount).toBe('60.00');
    });

    // Test 5 — summary correctness: only approved sums; count is all statuses.
    it('sums approved only but counts all statuses, per station', async () => {
      await repo.insertNewEvents([
        ev({ eventId: 'a', stationId: 'S1', amount: '100.00', status: 'approved' }),
        ev({ eventId: 'b', stationId: 'S1', amount: '50.25', status: 'approved' }),
        ev({ eventId: 'c', stationId: 'S1', amount: '999.00', status: 'declined' }),
        ev({ eventId: 'd', stationId: 'S1', amount: '12.00', status: 'pending' }),
        ev({ eventId: 'e', stationId: 'S2', amount: '5.00', status: 'approved' }), // other station
      ]);

      const s1 = await repo.getStationSummary('S1');
      expect(s1.eventsCount).toBe(4); // all statuses for S1
      expect(s1.totalApprovedAmount).toBe('150.25'); // approved only

      const s2 = await repo.getStationSummary('S2');
      expect(s2).toEqual({ stationId: 'S2', totalApprovedAmount: '5.00', eventsCount: 1 });
    });

    // Unknown station -> zeros, not an error.
    it('returns zeros for an unknown station', async () => {
      const summary = await repo.getStationSummary('does-not-exist');
      expect(summary).toEqual({
        stationId: 'does-not-exist',
        totalApprovedAmount: '0.00',
        eventsCount: 0,
      });
    });

    // Test 7 — precision: summing many decimals stays exact (proves NUMERIC).
    it('keeps the approved sum exact over many decimal amounts', async () => {
      const events: TransferEvent[] = [];
      for (let i = 0; i < 100; i++) {
        events.push(ev({ eventId: `p${i}`, amount: '0.10', status: 'approved' }));
      }
      await repo.insertNewEvents(events);
      const summary = await repo.getStationSummary('S1');
      // 100 * 0.10 = 10.00 exactly; a float accumulation would drift.
      expect(summary.totalApprovedAmount).toBe('10.00');
      expect(summary.eventsCount).toBe(100);
    });
  });
}
