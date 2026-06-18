import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema. Checked in as a reviewable artifact — `synchronize` is never
 * used, so this migration is the single source of truth for the table's DDL.
 */
export class CreateTransferEvents1718600000000 implements MigrationInterface {
  name = 'CreateTransferEvents1718600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "transfer_events" (
        "event_id"    text        NOT NULL,
        "station_id"  text        NOT NULL,
        "amount"      numeric(14,2) NOT NULL,
        "status"      text        NOT NULL,
        "created_at"  timestamptz NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_transfer_events" PRIMARY KEY ("event_id"),
        CONSTRAINT "chk_transfer_events_amount_nonneg" CHECK ("amount" >= 0)
      )
    `);

    // Covering index for the reconciliation query: filter/group by station,
    // INCLUDE amount so the approved-sum can be answered index-only.
    await queryRunner.query(`
      CREATE INDEX "idx_transfer_events_station_status"
      ON "transfer_events" ("station_id", "status") INCLUDE ("amount")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_transfer_events_station_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transfer_events"`);
  }
}
