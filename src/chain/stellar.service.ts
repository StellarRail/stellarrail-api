import { Injectable, ServiceUnavailableException } from '@nestjs/common';
export class ChainError extends Error { code: string; constructor(code: string, msg: string) { super(msg); this.code = code; } }
@Injectable()
export class StellarService {
  calls = 0; fails = 0; latencies: number[] = [];
  mockMode: 'ok' | 'down' | 'fail-tx' = 'ok';
  consecFails = 0; pausedUntil = 0;
  dryRun(): boolean { return (process.env.CHAIN_DRY_RUN || 'true') === 'true'; }
  private async withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    if (Date.now() < this.pausedUntil) throw new ChainError('RPC_DOWN', 'circuit open');
    let last: unknown;
    const t0 = Date.now();
    for (let i = 0; i < 3; i++) {
      try {
        if (this.mockMode === 'down') throw new Error('RPC 500');
        const out = await fn();
        this.consecFails = 0;
        this.latencies.push(Date.now() - t0);
        return out;
      } catch (e) { last = e; this.consecFails++; await new Promise((r) => setTimeout(r, 50 * (i + 1))); }
    }
    if (this.consecFails >= 10) this.pausedUntil = Date.now() + 60000;
    this.fails++;
    throw new ChainError('RPC_DOWN', `RPC down after retries (${label}): ${last}`);
  }
  async sendTransaction(xdr: string): Promise<{ hash: string }> {
    this.calls++;
    return this.withRetry(async () => {
      if (this.dryRun()) return { hash: `DRYRUN-${Date.now().toString(36).toUpperCase()}` };
      if (this.mockMode === 'fail-tx') throw new ChainError('TX_FAILED', 'tx failed');
      return { hash: `TX-${Date.now().toString(36)}` };
    }, 'sendTransaction');
  }
  async getTransaction(hash: string): Promise<{ status: string; ledger?: number }> {
    this.calls++;
    return this.withRetry(async () => {
      if (this.dryRun() || hash.startsWith('DRYRUN')) return { status: 'SUCCESS', ledger: 12345 };
      return { status: 'SUCCESS', ledger: 12346 };
    }, 'getTransaction');
  }
  async getEvents(): Promise<any[]> { return []; }
}
