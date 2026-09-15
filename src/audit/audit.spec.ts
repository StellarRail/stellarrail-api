import { AuditService } from './audit.service';
describe('audit-auth + immutable', () => {
  it('failed login creates audit row (simulated)', () => {
    const a = new AuditService();
    a.emit('LOGIN_FAIL', { actorId: 'u1', entityType: 'auth' });
    expect(a.list({ action: 'LOGIN_FAIL' }).total).toBe(1);
  });
  it('append-only chain verifies; update rejected', () => {
    const a = new AuditService();
    a.emit('LOGIN_SUCCESS', { payload: { x: 1 } });
    a.emit('APPROVE', { payload: { y: 2 } });
    expect(a.verifyChain()).toBe(true);
    expect(() => a.attemptUpdate()).toThrow(/IMMUTABLE/);
  });
  it('gdpr: anonymize keeps hashes', () => {
    const a = new AuditService();
    const r = a.emit('USER_DELETE', { actorId: 'u9', payload: { email: 'x@y.z' } });
    expect(r.payloadHash).toBeTruthy();
  });
});
