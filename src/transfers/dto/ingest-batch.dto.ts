import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TransferEventDto } from './transfer-event.dto';

export class IngestBatchDto {
  @ApiProperty({ type: [TransferEventDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'events must be a non-empty array' })
  @ArrayMaxSize(100000, { message: 'events array is too large' })
  @ValidateNested({ each: true })
  @Type(() => TransferEventDto)
  events!: TransferEventDto[];
}
