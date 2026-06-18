import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Validates/escapes the path param so a station_id can never be concatenated
 * raw into a query. The adapters use parameterised queries regardless, but
 * validating at the edge keeps the SQL-injection surface at zero. (Security §)
 */
export class StationIdParam {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  station_id!: string;
}
