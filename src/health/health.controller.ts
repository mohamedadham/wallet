import { Controller, Get, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Optional() private readonly dataSource?: DataSource) {}

  @Get('live')
  @ApiOkResponse({ description: 'Process is alive.' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'Process is ready to serve traffic.' })
  @ApiServiceUnavailableResponse({
    description: 'A dependency (e.g. the database) is unreachable.',
  })
  async ready() {
    if (!this.dataSource) {
      return { status: 'ok', store: 'memory' };
    }
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', store: 'postgres', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
  }

  @Get()
  @ApiOkResponse({ description: 'Aggregate health (alias for readiness).' })
  async health() {
    return this.ready();
  }
}
