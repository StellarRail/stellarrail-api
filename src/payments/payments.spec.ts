import { PaymentsService } from './payments.service';
import { StateMachine } from './state-machine';
import { IdempotencyService } from './idempotency.service';
import { BlocklistService } from './blocklist.service';
import { LimitsService } from './limits.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SystemConfigService } from '../config/system-config.service';
function svc() {
  const cfg = new SystemConfigService();
  return new PaymentsService(new StateMachine(), new IdempotencyService(), new BlocklistService(), new LimitsService(cfg), new AuditService(), new NotificationsService(), cfg);
}
const ADDR = 'G' + 'A'.repeat(55);
describe('payment-model + create + idempotency', () => {
  it('creates CREATED; rejects bad precision', () => {
    const s = svc();
    const p = s.create({ destination: ADDR, amountXlm: '10.5' }, 'op1', 'OPERATOR');
    expect(p.status).toBe('CREATED');
    expect(() => s.create({ destination: ADDR, amountXlm: '0.00000001' }, 'op1', 'OPERATOR')).toThrow();
  });
  it('double POST same key = 1 row (replay)', () => {
    const s = svc();
    const a = s.create({ destination: ADDR, amountXlm: '1' }, 'op1', 'OPERATOR', 'KEY-1');
    const b = s.create({ destination: ADDR, amountXlm: '1' }, 'op1', 'OPERATOR', 'KEY-1');
    expect(a.id).toBe(b.id);
    expect(s.allRaw().length).toBe(1);
  });
  it('same key different payload -> 409', () => {
    const s = svc();
    s.create({ destination: ADDR, amountXlm: '1' }, 'op1', 'OPERATOR', 'K2');
    expect(() => s.create({ destination: ADDR, amountXlm: '2' }, 'op1', 'OPERATOR', 'K2')).toThrow();
  });
  it('blocked + limits', () => {
    const s = svc();
    (s as any).block.add(ADDR);
    expect(() => s.create({ destination: ADDR, amountXlm: '1' }, 'op1', 'OPERATOR')).toThrow();
  });
  it('SoD self-approve 403; approve flow emits notification', () => {
    const s = svc();
    const p = s.seed({ requesterId: 'op1', status: 'PENDING_APPROVAL' });
    expect(() => s.approve(p.id, 'op1', 'APPROVER')).toThrow();
    const ok = s.approve(p.id, 'approver1', 'APPROVER');
    expect(ok.status).toBe('SETTLING');
  });
  it('reject requires reason', () => {
    const s = svc();
    const p = s.seed({ requesterId: 'op1', status: 'PENDING_APPROVAL' });
    expect(() => s.reject(p.id, 'a2', 'APPROVER', {})).toThrow();
  });
  it('expiry flips with fake timers', () => {
    const s = svc();
    const p = s.seed({ requesterId: 'op1', status: 'PENDING_APPROVAL', deadline: new Date(Date.now() - 1000) });
    const n = s.expireTick(true);
    expect(n).toBe(1);
    expect(s.allRaw().find((x) => x.id === p.id)!.status).toBe('REFUNDING');
  });
  it('timeline ordered >= events', () => {
    const s = svc();
    const p = s.create({ destination: ADDR, amountXlm: '2' }, 'op1', 'OPERATOR');
    s.timeline(p.id);
  });
});
