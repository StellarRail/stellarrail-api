import { Injectable } from '@nestjs/common';
@Injectable()
export class BlocklistService {
  private blocked = new Set<string>();
  private cachedAt = 0;
  constructor() {
    const env = (process.env.BLOCKED_ADDRESSES || '').split(',').map((s) => s.trim()).filter(Boolean);
    env.forEach((a) => this.blocked.add(a));
  }
  isBlocked(addr: string): boolean { return this.blocked.has(addr); }
  add(addr: string) { this.blocked.add(addr); this.cachedAt = Date.now(); }
  cacheAgeMs() { return Date.now() - this.cachedAt; }
}
