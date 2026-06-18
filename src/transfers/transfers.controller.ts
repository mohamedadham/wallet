import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import { IngestBatchDto } from './dto/ingest-batch.dto';
import { IngestResultDto } from './dto/ingest-result.dto';
import { StationSummaryDto } from './dto/station-summary.dto';
import { StationIdParam } from './dto/station-id.param';
import { TransferEvent } from './domain/transfer-event';
import { StationSummary } from './domain/station-summary';

@ApiTags('transfers')
@Controller()
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Post('transfers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ingest a batch of transfer events (idempotent by event_id).',
  })
  @ApiOkResponse({ type: IngestResultDto })
  async ingest(@Body() body: IngestBatchDto): Promise<IngestResultDto> {
    const events: TransferEvent[] = body.events.map((e) => ({
      eventId: e.event_id,
      stationId: e.station_id,
      amount: e.amount,
      status: e.status,
      createdAt: new Date(e.created_at),
    }));

    return this.service.ingestBatch(events);
  }

  @Get('stations/:station_id/summary')
  @ApiOperation({ summary: 'Reconciliation summary for a station.' })
  @ApiOkResponse({ type: StationSummaryDto })
  async summary(@Param() params: StationIdParam): Promise<StationSummaryDto> {
    const summary: StationSummary = await this.service.getStationSummary(params.station_id);
    return {
      station_id: summary.stationId,
      total_approved_amount: summary.totalApprovedAmount,
      events_count: summary.eventsCount,
    };
  }
}
