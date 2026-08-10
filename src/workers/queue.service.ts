import { Injectable, OnModuleDestroy } from '@nestjs/common';
@Injectable()
export class QueueService implements OnModuleDestroy {
  queues: Record<string, any[]> = { payments: [], reconciliation: [], notifications: [] };
  redisAvailable = false;
  async enqueue(name: string, job: any) {
    if (!this.queues[name]) this.queues[name] = [];
    this.queues[name].push(job);
    return { queued: true, name };
  }
  depths() { return Object.fromEntries(Object.entries(this.queues).map(([k, v]) => [k, v.length])); }
  async onModuleDestroy() { /* graceful: drain marker */ }
}
