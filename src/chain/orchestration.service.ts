import { Injectable } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { SignerService } from './signer.service';
import { StellarService } from './stellar.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
@Injectable()
export class OrchestrationService {
  attempts = new Map<string, number>();
  dlq: any[] = [];
  constructor(private payments: PaymentsService, private signer: SignerService, private stellar: StellarService, private audit: AuditService, private notif: NotificationsService) {}
  private async submitWithBackoff(paymentId: string, kind: 'deposit' | 'release' | 'refund', buildXdr: () => string, maxAttempts = 5): Promise<string | null> {
    let attempt = this.attempts.get(paymentId + kind) || 0;
    while (attempt < maxAttempts) {
      try {
        const signed = await this.signer.signEnvelope(buildXdr());
        const { hash } = await this.stellar.sendTransaction(signed);
        const conf = await this.stellar.getTransaction(hash);
        if (conf.status === 'SUCCESS') return hash;
        throw new Error('TX_FAILED');
      } catch (e) {
        attempt++; this.attempts.set(paymentId + kind, attempt);
        if (attempt >= maxAttempts) { this.dlq.push({ paymentId, kind, error: String(e), at: new Date() }); return null; }
        await new Promise((r) => setTimeout(r, 100 * attempt));
      }
    }
    return null;
  }
  async deposit(paymentId: string) {
    const all = this.payments.allRaw();
    const p = all.find((x) => x.id === paymentId);
    if (!p || p.status !== 'CREATED') return p;
    const hash = await this.submitWithBackoff(paymentId, 'deposit', () => `escrow.deposit(${p.id},${p.amountStroops})`);
    if (!hash) { try { this.payments.transition(p, 'TIMEOUT', 'system', 'DEPOSIT_FAILED'); } catch { /* noop */ } return p; }
    p.escrowTxHash = hash;
    try { this.payments.transition(p, 'LOCKED_IN_ESCROW', 'system', 'ESCROW_LOCKED'); this.payments.transition(p, 'PENDING_APPROVAL', 'system', 'DEPOSIT_CONFIRMED'); } catch { /* noop */ }
    this.notif.enqueue('PAYMENT_PENDING', { paymentId: p.id });
    return p;
  }
  async release(paymentId: string) {
    const p = this.payments.allRaw().find((x) => x.id === paymentId);
    if (!p) return;
    if (p.status === 'SETTLED' && p.releaseTxHash) return p; // idempotent
    const hash = await this.submitWithBackoff(paymentId, 'release', () => `escrow.release(${p.id},${p.destination})`);
    if (!hash) { this.audit.emit('RELEASE_FAILED', { entityType: 'payment', entityId: paymentId }); return p; }
    p.releaseTxHash = hash;
    try { this.payments.transition(p, 'SETTLED', 'system', 'PAYMENT_SETTLED'); } catch { /* noop */ }
    this.notif.enqueue('PAYMENT_SETTLED', { paymentId });
    return p;
  }
  async refund(paymentId: string) {
    const p = this.payments.allRaw().find((x) => x.id === paymentId);
    if (!p) return;
    if (p.status === 'REFUNDED' && p.refundTxHash) return p;
    const hash = await this.submitWithBackoff(paymentId, 'refund', () => `escrow.refund(${p.id})`);
    if (!hash) return p;
    p.refundTxHash = hash;
    try { this.payments.transition(p, 'REFUNDED', 'system', 'PAYMENT_REFUNDED'); } catch { /* noop */ }
    this.notif.enqueue('PAYMENT_REFUNDED', { paymentId });
    return p;
  }
}
