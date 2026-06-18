import { ApiProperty } from '@nestjs/swagger';

export class StationSummaryDto {
  @ApiProperty({ example: 'S1' })
  station_id!: string;

  @ApiProperty({
    example: '450.25',
    description:
      'Exact decimal string. Sum of approved amounts only; serialized as a string to avoid float error in JSON.',
  })
  total_approved_amount!: string;

  @ApiProperty({ example: 12, description: 'Count of all stored events (every status).' })
  events_count!: number;
}
