import { Injectable } from '@nestjs/common';
import { TransferRepository, InsertResult } from '../../ports/transfer-repository.port';
import { TransferEvent, isApproved } from '../../domain/transfer-event';
import { StationSummary } from '../../domain/station-summary';

@Injectable()
export class InMemoryTransferRepository extends TransferRepository {
  private readonly store = new Map<string, TransferEvent>();

  async insertNewEvents(events: TransferEvent[]): Promise<InsertResult> {
    let inserted = 0;

    for (const event of events) {
      if (this.store.has(event.eventId)) {
        continue;
      }
      this.store.set(event.eventId, event);
      inserted++;
    }

    return { inserted, duplicates: events.length - inserted };
  }

  async getStationSummary(stationId: string): Promise<StationSummary> {
    let eventsCount = 0;
    let totalCents = 0n;

    for (const event of this.store.values()) {
      if (event.stationId !== stationId) continue;
      eventsCount++;
      if (isApproved(event.status)) {
        totalCents += toCents(event.amount);
      }
    }

    return {
      stationId,
      totalApprovedAmount: centsToDecimalString(totalCents),
      eventsCount,
    };
  }

  clear(): void {
    this.store.clear();
  }
}

function toCents(amount: string): bigint {
  const [whole, frac = ''] = amount.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  return BigInt(whole) * 100n + BigInt(fracPadded || '0');
}

function centsToDecimalString(cents: bigint): string {
  const whole = cents / 100n;
  const frac = cents % 100n;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}
