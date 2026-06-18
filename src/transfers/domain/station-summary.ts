/**
 * Result of a reconciliation query for one station.
 *
 * `totalApprovedAmount` is a string for the same reason `amount` is on
 * TransferEvent: the NUMERIC sum comes back from pg as an exact decimal string
 * and we keep it exact rather than reintroducing float error via parseFloat.
 */
export interface StationSummary {
  stationId: string;
  /** Exact decimal string, e.g. "450.25". Sum of approved amounts only. */
  totalApprovedAmount: string;
  /** Count of ALL stored events for the station, regardless of status. */
  eventsCount: number;
}
