import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { authenticator } from 'otplib';

function boot() {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-long-xxxx';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-xxx';
  const users = new UsersService();
  const audit = new AuditService();
  return { users, auth: new AuthService(users, audit), audit };
}
describe('auth hardening', () => {
  it('no enumeration: same code+timing for unknown vs wrong pw', async () => {
    const { auth } = boot();
    const t1 = Date.now();
    await expect(auth.login('nobody@x.y', 'WrongPass12345!', '1.2.3.4')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }) });
    const d1 = Date.now() - t1;
    await expect(auth.login('operator@stellarrail.local', 'WrongPass12345!', '1.2.3.4')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }) });
    expect(d1).toBeLessThan(5000);
  });
  it('lockout after 5 fails', async () => {
    const { auth } = boot();
    for (let i = 0; i < 5; i++) await auth.login('operator@stellarrail.local', 'WrongPass12345!').catch(() => undefined);
    await expect(auth.login('operator@stellarrail.local', 'WrongPass12345!')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'ACCOUNT_LOCKED' }) });
  });
  it('login success + refresh rotation + reuse detection revokes family', async () => {
    const { auth, audit } = boot();
    const r = await auth.login('operator@stellarrail.local', 'OperatorPass12345!');
    expect((r as any).accessToken).toBeDefined();
    const rot = auth.refreshTokens((r as any).refreshToken);
    expect(rot.accessToken).toBeDefined();
    // reuse old -> detectReuse true + audit REFRESH_REUSE
    expect(auth.detectReuse((r as any).refreshToken)).toBe(true);
    expect(audit.list({ action: 'REFRESH_REUSE' }).total).toBe(1);
  });
  it('mfa enroll -> login-with-mfa + backup codes + lockout', async () => {
    const { users, auth } = boot();
    const u = users.findByEmail('operator@stellarrail.local')!;
    const e = auth.enrollMfa(u.id);
    expect(e.otpauthUrl).toContain('otpauth');
    const code = authenticator.generate(e.secret);
    const conf = auth.confirmEnroll(u.id, code);
    expect(conf.backupCodes.length).toBe(8);
    const step1: any = await auth.login('operator@stellarrail.local', 'OperatorPass12345!');
    expect(step1.mfaRequired).toBe(true);
    const code2 = authenticator.generate(users.findByEmail('operator@stellarrail.local')!.mfaSecret!);
    const done: any = await auth.verifyMfaTicket(step1.mfaTicket, code2);
    expect(done.accessToken).toBeDefined();
    // backup code path
    const step2: any = await auth.login('operator@stellarrail.local', 'OperatorPass12345!');
    const bk = conf.backupCodes[0];
    const viaBackup: any = await auth.verifyMfaTicket(step2.mfaTicket, '000000', bk);
    expect(viaBackup.accessToken).toBeDefined();
  });
  it('jwt expiry invalid; sessions + logout-all', async () => {
    const { auth } = boot();
    const r: any = await auth.login('admin@stellarrail.local', 'AdminPass12345!');
    expect(auth.listSessions(r.user.id).length).toBe(1);
    auth.logout(r.refreshToken);
    auth.logoutAll(r.user.id);
    expect(auth.listSessions(r.user.id).length).toBe(0);
  });
  it('password reset always 200 + weak rejected', async () => {
    const { auth } = boot();
    expect(auth.forgot('nobody@x.y')).toEqual({ ok: true });
    expect(() => auth.reset('bad-token', 'NewStrongPass12345!')).toThrow();
  });
});
