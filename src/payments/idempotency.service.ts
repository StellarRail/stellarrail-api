import { Injectable, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
@Injectable()
export class IdempotencyService {
  private keys = new Map<string, { reqHash: string; response: any; at: number }>();
  handle(key: string | undefined, payload: unknown): { replay: boolean; response?: any } {
    if (!key) return { replay: false };
    const h = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const row = this.keys.get(key);
    if (!row) return { replay: false };
    if (Date.now() - row.at > 24 * 3600e3) { this.keys.delete(key); return { replay: false }; }
    if (row.reqHash !== h) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key reused with different payload' });
    return { replay: true, response: row.response };
  }
  store(key: string | undefined, payload: unknown, response: any) {
    if (!key) return;
    const h = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    this.keys.set(key, { reqHash: h, response, at: Date.now() });
  }
  count() { return this.keys.size; }
}
