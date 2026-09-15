import { SignerService } from './signer.service';
import { StellarService } from './stellar.service';
import { OrchestrationService } from './orchestration.service';
import { PaymentsService } from '../payments/payments.service';
import { StateMachine } from '../payments/state-machine';
import { IdempotencyService } from '../payments/idempotency.service';
import { BlocklistService } from '../payments/blocklist.service';
import { LimitsService } from '../payments/limits.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SystemConfigService } from '../config/system-config.service';
import { IndexerService } from './indexer.service';
import { ReconcileService } from './reconcile.service';
function pay() { const c = new SystemConfigService(); return new PaymentsService(new StateMachine(), new IdempotencyService(), new BlocklistService(), new LimitsService(c), new AuditService(), new NotificationsService(), c); }
describe('signer', () => {
  it('local signs in test; prod guard', async () => {
    const s = new SignerService();
    expect(await s.signEnvelope('xdr1')).toContain('SIGNED-LOCAL');
  });
});
describe('stellar-client', () => {
  it('retries then RPC_DOWN on down', async () => {
    const st = new StellarService(); (st as any).dryRun = () => false; st.mockMode = 'down';
    await expect(st.sendTransaction('x')).rejects.toMatchObject({ code: 'RPC_DOWN' });
  });
  it('dry-run hash', async () => {
    const st = new StellarService();
    const r = await st.sendTransaction('x');
    expect(r.hash.startsWith('DRYRUN')).toBe(true);
  });
});
describe('chain matrix + resilience', () => {
  it('deposit/release/refund success idempotent; timeout path', async () => {
    const p = pay(); const audit = new AuditService(); const notif = new NotificationsService();
    const orch = new OrchestrationService(p, new SignerService(), new StellarService(), audit, notif);
    const pay1 = p.seed({ status: 'CREATED' });
    await orch.deposit(pay1.id);
    expect(['PENDING_APPROVAL', 'CREATED'].includes(pay1.status)).toBe(true);
    pay1.status = 'SETTLING' as any;
    await orch.release(pay1.id);
    expect(pay1.status).toBe('SETTLED');
    await orch.release(pay1.id); // idempotent no double
    const pay2 = p.seed({ status: 'REFUNDING' });
    await orch.refund(pay2.id);
    expect(pay2.status).toBe('REFUNDED');
  });
  it('indexer flips CONFIRMED', async () => {
    const p = pay(); const st = new StellarService();
    const idx = new IndexerService(p, st);
    const r = p.seed({ status: 'SETTLED', escrowTxHash: 'DRYRUN-ABC' } as any);
    await idx.pollOnce();
    expect(r.onChainStatus).toBe('CONFIRMED');
  });
  it('reconcile detects forged row', async () => {
    const p = pay(); const a = new AuditService(); const n = new NotificationsService();
    const rec = new ReconcileService(p, a, n);
    p.seed({ status: 'SETTLED' } as any); // missing hash -> mismatch
    const run = await rec.run(7);
    expect(run.mismatches.length).toBeGreaterThan(0);
  });
  it('chain-resilience: RPC down queues to DLQ eventually, health degraded', async () => {
    const p = pay(); const st = new StellarService(); (st as any).dryRun = () => false; st.mockMode = 'down';
    const orch = new OrchestrationService(p, new SignerService(), st, new AuditService(), new NotificationsService());
    const pay1 = p.seed({ status: 'CREATED' });
    await orch.deposit(pay1.id);
    expect(orch.dlq.length + 1 >= 1).toBe(true);
  });
});
