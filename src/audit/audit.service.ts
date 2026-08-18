import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
export interface AuditRow { id: string; timestamp: Date; actorId?: string; action: string; entityType: string; entityId?: string; payloadHash: string; ip?: string; userAgent?: string; prevHash: string; hash: string; }
function canonical(o: unknown): string { return JSON.stringify(o, Object.keys(o as any || {}).sort()); }
@Injectable()
export class AuditService {
  private rows: AuditRow[] = [];
  private lastHash = 'GENESIS';
  emit(action: string, opts: { actorId?: string; entityType?: string; entityId?: string; payload?: unknown; ip?: string; userAgent?: string } = {}): AuditRow {
    const payloadHash = createHash('sha256').update(canonical(opts.payload ?? {})).digest('hex');
    const prevHash = this.lastHash;
    const id = randomUUID();
    const timestamp = new Date();
    const hash = createHash('sha256').update(prevHash + canonical({ id, action, payloadHash })).digest('hex');
    const row: AuditRow = { id, timestamp, actorId: opts.actorId, action, entityType: opts.entityType || 'system', entityId: opts.entityId, payloadHash, ip: opts.ip, userAgent: opts.userAgent, prevHash, hash };
    this.rows.push(row); this.lastHash = hash;
    return row;
  }
  list(filters: { action?: string; entityId?: string; page?: number; limit?: number } = {}) {
    let r = [...this.rows].reverse();
    if (filters.action) r = r.filter((x) => x.action === filters.action);
    if (filters.entityId) r = r.filter((x) => x.entityId === filters.entityId);
    const page = filters.page || 1; const limit = Math.min(filters.limit || 20, 100);
    return { data: r.slice((page - 1) * limit, page * limit), total: r.length, page, limit };
  }
  all() { return this.rows; }
  verifyChain(): boolean {
    let prev = 'GENESIS';
    for (const r of this.rows) {
      if (r.prevHash !== prev) return false;
      const h = createHash('sha256').update(r.prevHash + canonical({ id: r.id, action: r.action, payloadHash: r.payloadHash })).digest('hex');
      if (h !== r.hash) return false;
      prev = r.hash;
    }
    return true;
  }
  // simulate immutability: updates rejected
  attemptUpdate(): never { throw new Error('AUDIT_IMMUTABLE: UPDATE rejected'); }
  exportCsv(): string {
    const head = 'timestamp,actor,action,hash,ip';
    return [head, ...this.rows.map((r) => `${r.timestamp.toISOString()},${r.actorId || ''},${r.action},${r.hash},${r.ip || ''}`)].join('\n');
  }
}
