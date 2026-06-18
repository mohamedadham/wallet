import {
  IsISO8601,
  IsNotEmpty,
  IsNumberString,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class TransferEventDto {
  @ApiProperty({ example: 'evt_001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  event_id!: string;

  @ApiProperty({ example: 'S1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  station_id!: string;

  @ApiProperty({ example: '100.50' })
  @Transform(({ value }) => (typeof value === 'number' ? value.toString() : value), {
    toClassOnly: true,
  })
  @IsNumberString({ no_symbols: false }, { message: 'amount must be a number' })
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a non-negative number' })
  amount!: string;

  @ApiProperty({ example: 'approved' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  status!: string;

  @ApiProperty({ example: '2026-02-19T10:00:00Z' })
  @IsISO8601({ strict: true }, { message: 'created_at must be a valid ISO8601 date' })
  created_at!: string;
}
