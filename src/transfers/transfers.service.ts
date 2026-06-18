import { Injectable } from '@nestjs/common';
import { TransferRepository, InsertResult } from './ports/transfer-repository.port';
import { TransferEvent } from './domain/transfer-event';
import { StationSummary } from './domain/station-summary';

@Injectable()
export class TransfersService {
  constructor(private readonly repository: TransferRepository) {}

  async ingestBatch(events: TransferEvent[]): Promise<InsertResult> {
    const unique = new Map<string, TransferEvent>();
    for (const event of events) {
      if (!unique.has(event.eventId)) {
        unique.set(event.eventId, event);
      }
    }

    const inBatchDuplicates = events.length - unique.size;
    const result = await this.repository.insertNewEvents([...unique.values()]);

    return {
      inserted: result.inserted,
      duplicates: result.duplicates + inBatchDuplicates,
    };
  }

  async getStationSummary(stationId: string): Promise<StationSummary> {
    return this.repository.getStationSummary(stationId);
  }
}
