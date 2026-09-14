import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PaymentsService } from '../payments/payments.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
export interface ReconRun { id: string; startedAt: Date; finishedAt: Date; checked: number; mismatches: any[]; status: string; }
@Injectable()
export class ReconcileService {
  runs: ReconRun[] = [];
  constructor(private payments: PaymentsService, private audit: AuditService, private notif: NotificationsService) {}
  async run(windowDays = 1): Promise<ReconRun> {
    const startedAt = new Date();
    const since = Date.now() - windowDays * 86400e3;
    const rows = this.payments.allRaw().filter((p) => p.createdAt.getTime() >= since && ['SETTLED', 'REFUNDED'].includes(p.status));
    const mismatches: any[] = [];
    for (const p of rows) {
      if (p.onChainStatus && p.onChainStatus !== 'CONFIRMED') { mismatches.push({ paymentId: p.id, reason: 'onchain not confirmed' }); p.needsReview = true; }
      else if ((p.status === 'SETTLED' && !p.releaseTxHash) || (p.status === 'REFUNDED' && !p.refundTxHash)) { mismatches.push({ paymentId: p.id, reason: 'missing chain hash' }); p.needsReview = true; }
    }
    const run: ReconRun = { id: randomUUID(), startedAt, finishedAt: new Date(), checked: rows.length, mismatches, status: mismatches.length ? 'MISMATCH' : 'OK' };
    this.runs.push(run);
    if (mismatches.length) {
      this.audit.emit('RECON_MISMATCH', { entityType: 'reconciliation', entityId: run.id, payload: { mismatches } });
      this.notif.enqueue('RECON_MISMATCH', { runId: run.id, mismatches });
    }
    return run;
  }
  @Cron('0 2 * * *')
  async nightly() { await this.run(1); }
}
