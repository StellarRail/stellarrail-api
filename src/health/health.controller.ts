import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { MetricsService } from '../common/metrics/metrics.service';
@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private h: HealthService) {}
  @Get() health() { return this.h.status(); }
  @Get('live') live() { return { status: 'ok' }; }
  @Get('ready') ready() {
    const s = this.h.status();
    if (s.db !== 'up' || s.redis !== 'up') throw new ServiceUnavailableException('not ready');
    return { status: 'ready' };
  }
  @Get('db') db() { return { db: this.h.dbOk ? 'up' : 'down' }; }
  @Get('redis') redis() { return { redis: this.h.redisOk ? 'up' : 'down' }; }
  @Get('chain') chain() { return { chain: this.h.chainOk ? 'up' : 'degraded', queueDepths: this.h.queueDepths, dlqSize: this.h.dlq }; }
}
@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  @Get() metrics() { return MetricsService.render(); }
}
