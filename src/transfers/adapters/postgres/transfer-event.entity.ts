import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * TypeORM mapping for the transfer_events table.
 *
 * The schema is owned by migrations (see ./migrations), NOT by this entity:
 * `synchronize` is OFF everywhere. The entity exists so the query builder can
 * type the table; the migration is the reviewable source of truth for DDL.
 *
 * Key decisions (mirrored in the migration and documented in the README):
 *   - eventId is the PRIMARY KEY: uniqueness, idempotency anchor and concurrency
 *     guard are one and the same database object.
 *   - amount is NUMERIC(14,2): exact decimal money, never float. We read it back
 *     as a string (pg returns numeric as text) and never parseFloat it.
 */
@Entity({ name: 'transfer_events' })
// Covering index for the summary query: count by station + sum approved amount.
// Including `amount` lets the totals query be answered index-only.
@Index('idx_transfer_events_station_status', ['stationId', 'status'])
export class TransferEventEntity {
  @PrimaryColumn({ name: 'event_id', type: 'text' })
  eventId!: string;

  @Column({ name: 'station_id', type: 'text' })
  stationId!: string;

  @Column({ name: 'amount', type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Column({ name: 'status', type: 'text' })
  status!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt!: Date;
}
