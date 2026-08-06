import { Injectable } from '@nestjs/common';
@Injectable()
export class HealthService {
  dbOk = true; redisOk = true; chainOk = true; queueDepths = { payments: 0, reconciliation: 0, notifications: 0 }; dlq = 0;
  status() {
    const all = this.dbOk && this.redisOk;
    return { api: 'up', db: this.dbOk ? 'up' : 'down', redis: this.redisOk ? 'up' : 'down', chain: this.chainOk ? 'up' : 'degraded', queueDepths: this.queueDepths, dlqSize: this.dlq, network: process.env.STELLAR_NETWORK || 'testnet' };
  }
}
