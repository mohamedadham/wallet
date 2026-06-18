import { ApiProperty } from '@nestjs/swagger';

export class IngestResultDto {
  @ApiProperty({ example: 7, description: 'Number of genuinely new events stored.' })
  inserted!: number;

  @ApiProperty({
    example: 3,
    description: 'Events that were already stored or duplicated within the batch.',
  })
  duplicates!: number;
}
