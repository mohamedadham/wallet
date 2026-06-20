import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StationIdParam {
  @ApiProperty({ example: 'S1', description: 'The station identifier' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  station_id!: string;
}
