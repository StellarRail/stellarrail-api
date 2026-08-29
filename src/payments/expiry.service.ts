import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
@Injectable()
export class ExpiryService {
  tickFn: (() => number) | null = null;
  @Cron('*/5 * * * *')
  handle() { if (this.tickFn) this.tickFn(); }
}
