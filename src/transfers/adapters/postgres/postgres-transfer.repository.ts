import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransferRepository, InsertResult } from '../../ports/transfer-repository.port';
import { TransferEvent } from '../../domain/transfer-event';
import { StationSummary } from '../../domain/station-summary';
import { TransferEventEntity } from './transfer-event.entity';

@Injectable()
export class PostgresTransferRepository extends TransferRepository {
  constructor(
    @InjectRepository(TransferEventEntity)
    private readonly repo: Repository<TransferEventEntity>,
  ) {
    super();
  }

  async insertNewEvents(events: TransferEvent[]): Promise<InsertResult> {
    if (events.length === 0) {
      return { inserted: 0, duplicates: 0 };
    }

    const rows = events.map((e) => ({
      eventId: e.eventId,
      stationId: e.stationId,
      amount: e.amount,
      status: e.status,
      createdAt: e.createdAt,
    }));

    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(TransferEventEntity)
      .values(rows)
      .orIgnore()
      .returning('event_id')
      .execute();

    const inserted = result.raw?.length ?? 0;
    return { inserted, duplicates: events.length - inserted };
  }

  async getStationSummary(stationId: string): Promise<StationSummary> {
    const row = await this.repo
      .createQueryBuilder('e')
      .select('COUNT(*)', 'events_count')
      .addSelect(
        `COALESCE(SUM(CASE WHEN e.status = :approved THEN e.amount ELSE 0 END), 0)`,
        'total_approved_amount',
      )
      .where('e.station_id = :stationId', { stationId })
      .setParameter('approved', 'approved')
      .getRawOne<{ events_count: string; total_approved_amount: string }>();

    return {
      stationId,
      totalApprovedAmount: normalizeDecimal(row?.total_approved_amount ?? '0'),
      eventsCount: parseInt(row?.events_count ?? '0', 10),
    };
  }
}

function normalizeDecimal(value: string): string {
  const [whole, frac = ''] = value.split('.');
  return `${whole}.${(frac + '00').slice(0, 2)}`;
}
