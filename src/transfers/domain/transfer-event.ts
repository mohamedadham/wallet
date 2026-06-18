/**
 * The domain model of a transfer event — deliberately framework-free.
 *
 * `amount` is a STRING here, not a number. This is intentional and is the single
 * most important type decision in the project: money must never round-trip through
 * an IEEE-754 float (0.1 + 0.2 !== 0.3). We carry the exact decimal as text from
 * the edge (validated string) all the way to NUMERIC(14,2) in Postgres, and the
 * aggregate sum is computed in the database, never in JS. See README "Decision log".
 */
export interface TransferEvent {
  eventId: string;
  stationId: string;
  /** Exact decimal as a string, e.g. "100.50". Never a JS number. */
  amount: string;
  status: string;
  /** Event time upstream, stored as UTC. */
  createdAt: Date;
}

/** The one business rule, named so it can't be silently re-implemented elsewhere. */
export const APPROVED_STATUS = 'approved';

export function isApproved(status: string): boolean {
  return status === APPROVED_STATUS;
}
