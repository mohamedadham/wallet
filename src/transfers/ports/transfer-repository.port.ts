import { TransferEvent } from '../domain/transfer-event';
import { StationSummary } from '../domain/station-summary';

export interface InsertResult {
  inserted: number;
  duplicates: number;
}

export abstract class TransferRepository {
  abstract insertNewEvents(events: TransferEvent[]): Promise<InsertResult>;
  abstract getStationSummary(stationId: string): Promise<StationSummary>;
}

export const TRANSFER_REPOSITORY = TransferRepository;
