import { TransfersService } from './transfers.service';
import { InMemoryTransferRepository } from './adapters/in-memory/in-memory-transfer.repository';
import { TransferEvent } from './domain/transfer-event';

const ev = (id: string, over: Partial<TransferEvent> = {}): TransferEvent => ({
  eventId: id,
  stationId: 'S1',
  amount: '10.00',
  status: 'approved',
  createdAt: new Date('2026-02-19T10:00:00Z'),
  ...over,
});

describe('TransfersService', () => {
  let service: TransfersService;
  let repo: InMemoryTransferRepository;

  beforeEach(() => {
    repo = new InMemoryTransferRepository();
    service = new TransfersService(repo);
  });

  // Test 1 — batch insert returns correct inserted/duplicates, INCLUDING
  // duplicates that appear within the same request.
  it('counts in-batch duplicates as duplicates', async () => {
    const result = await service.ingestBatch([
      ev('a'),
      ev('b'),
      ev('a'), // duplicate within the batch
      ev('a'), // duplicate within the batch
    ]);
    expect(result).toEqual({ inserted: 2, duplicates: 2 });
  });

  it('combines in-batch and already-stored duplicates', async () => {
    await service.ingestBatch([ev('a')]);
    const result = await service.ingestBatch([
      ev('a'), // already stored
      ev('b'),
      ev('b'), // in-batch dup
    ]);
    expect(result).toEqual({ inserted: 1, duplicates: 2 });
  });
});
