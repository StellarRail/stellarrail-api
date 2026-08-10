import { Injectable, OnModuleDestroy } from '@nestjs/common';
@Injectable()
export class WorkersService implements OnModuleDestroy {
  concurrency = { payments: parseInt(process.env.WORKER_CONCURRENCY || '5', 10) };
  drained = false;
  async onModuleDestroy() { this.drained = true; }
}
