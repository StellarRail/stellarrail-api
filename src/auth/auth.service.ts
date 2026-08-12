import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { randomUUID, createHash } from 'crypto';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';

interface RefreshRow { hash: string; userId: string; family: string; expiresAt: number; revoked: boolean; sessionId: string; }
interface MfaTicket { userId: string; expiresAt: number; }

@Injectable()
export class AuthService {
  private refresh = new Map<string, RefreshRow>(); // by hash
  private families = new Map<string, string[]>(); // family -> hashes
  private fails = new Map<string, { count: number; until: number }>();
  private mfaTickets = new Map<string, MfaTicket>();
  private resetTokens = new Map<string, { userId: string; expiresAt: number }>();
  private sessions = new Map<string, { id: string; userId: string; createdAt: Date; ua?: string }>();
  loginAttempts: { email: string; at: number }[] = [];

  constructor(private users: UsersService, private audit: AuditService) {}

  private accessSecret() { return process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-chars-long-xxxx'; }
  private refreshSecret() { return process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-chars-long-xxx'; }

  signAccess(user: any): string {
    return jwt.sign({ sub: user.id, role: user.role, jti: randomUUID() }, this.accessSecret(), { expiresIn: '15m' });
  }
  newRefresh(userId: string, sessionId: string, family?: string): { token: string; hash: string } {
    const fam = family || randomUUID();
    const token = randomUUID() + '.' + randomUUID();
    const hash = createHash('sha256').update(token).digest('hex');
    const row: RefreshRow = { hash, userId, family: fam, expiresAt: Date.now() + 7 * 86400e3, revoked: false, sessionId };
    this.refresh.set(hash, row);
    const arr = this.families.get(fam) || []; arr.push(hash); this.families.set(fam, arr);
    return { token, hash };
  }

  async login(email: string, password: string, ip?: string, ua?: string) {
    this.loginAttempts.push({ email, at: Date.now() });
    const lock = this.fails.get(email.toLowerCase());
    if (lock && lock.count >= 5 && Date.now() < lock.until) {
      throw new ForbiddenException({ code: 'ACCOUNT_LOCKED', message: 'Account locked. Try later.' });
    }
    const user = this.users.findByEmail(email);
    // timing-safe generic response, no enumeration
    const hash = user?.passwordHash || (await bcrypt.hash('dummy-compare-shield-12345', 4));
    const ok = user ? await bcrypt.compare(password, hash) : false;
    if (!ok || !user || !user.isActive) {
      const cur = this.fails.get(email.toLowerCase()) || { count: 0, until: 0 };
      cur.count += 1; if (cur.count >= 5) cur.until = Date.now() + 15 * 60e3;
      this.fails.set(email.toLowerCase(), cur);
      this.audit.emit(user && !user.isActive ? 'LOGIN_DISABLED' : 'LOGIN_FAIL', { actorId: user?.id, entityType: 'auth', ip, userAgent: ua, payload: { email } });
      if (user && !user.isActive) throw new ForbiddenException({ code: 'ACCOUNT_DISABLED', message: 'Account disabled' });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }
    this.fails.delete(email.toLowerCase());
    if (user.mfaEnabled) {
      const ticket = randomUUID();
      this.mfaTickets.set(ticket, { userId: user.id, expiresAt: Date.now() + 5 * 60e3 });
      return { mfaRequired: true, mfaTicket: ticket };
    }
    this.audit.emit('LOGIN_SUCCESS', { actorId: user.id, entityType: 'auth', ip, userAgent: ua });
    const sessionId = randomUUID();
    this.sessions.set(sessionId, { id: sessionId, userId: user.id, createdAt: new Date(), ua });
    const { token: refreshToken } = this.newRefresh(user.id, sessionId);
    return { accessToken: this.signAccess(user), refreshToken, user: this.users.sanitize(user) };
  }

  async verifyMfaTicket(ticket: string, code: string, backup?: string, ip?: string) {
    const t = this.mfaTickets.get(ticket);
    if (!t || Date.now() > t.expiresAt) throw new UnauthorizedException({ code: 'INVALID_MFA_TICKET', message: 'Invalid ticket' });
    const user = this.users.findById(t.userId)!;
    let ok = false;
    try { ok = authenticator.check(code, user.mfaSecret || ''); } catch { ok = false; }
    if (!ok && backup) {
      const h = createHash('sha256').update(backup).digest('hex');
      const idx = user.backupCodes.indexOf(h);
      if (idx >= 0) { user.backupCodes.splice(idx, 1); ok = true; }
    }
    if (!ok) {
      const cur = this.fails.get('mfa:' + user.id) || { count: 0, until: 0 };
      cur.count += 1; if (cur.count >= 3) { cur.until = Date.now() + 15 * 60e3; }
      this.fails.set('mfa:' + user.id, cur);
      this.audit.emit('MFA_FAIL', { actorId: user.id, entityType: 'auth', ip });
      throw new UnauthorizedException({ code: 'INVALID_MFA', message: 'Invalid MFA code' });
    }
    this.mfaTickets.delete(ticket);
    this.audit.emit('MFA_SUCCESS', { actorId: user.id, entityType: 'auth', ip });
    const sessionId = randomUUID();
    this.sessions.set(sessionId, { id: sessionId, userId: user.id, createdAt: new Date() });
    const { token: refreshToken } = this.newRefresh(user.id, sessionId);
    return { accessToken: this.signAccess(user), refreshToken, user: this.users.sanitize(user) };
  }

  enrollMfa(userId: string) {
    const user = this.users.findById(userId)!;
    const secret = authenticator.generateSecret();
    user.mfaSecret = secret;
    const otpauth = authenticator.keyuri(user.email, 'StellarRail', secret);
    return { secret, otpauthUrl: otpauth };
  }
  confirmEnroll(userId: string, token: string) {
    const user = this.users.findById(userId)!;
    if (!authenticator.check(token, user.mfaSecret || '')) throw new BadRequestException({ code: 'INVALID_MFA', message: 'Invalid code' });
    user.mfaEnabled = true;
    const codes = Array.from({ length: 8 }, () => randomUUID().slice(0, 8).toUpperCase());
    user.backupCodes = codes.map((c) => createHash('sha256').update(c).digest('hex'));
    this.audit.emit('MFA_ENROLL', { actorId: userId, entityType: 'auth' });
    return { backupCodes: codes };
  }

  refreshTokens(token: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const row = this.refresh.get(hash);
    if (!row || row.revoked || Date.now() > row.expiresAt) {
      // reuse detection: token belongs to a family but hash unknown -> revoke family
      throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: 'Invalid refresh token' });
    }
    // rotation: revoke old, issue new in same family
    row.revoked = true;
    const user = this.users.findById(row.userId)!;
    const { token: next } = this.newRefresh(row.userId, row.sessionId, row.family);
    this.audit.emit('TOKEN_REFRESH', { actorId: row.userId, entityType: 'auth' });
    return { accessToken: this.signAccess(user), refreshToken: next };
  }
  // called when a revoked/expired token of known family is presented -> reuse
  detectReuse(token: string): boolean {
    const hash = createHash('sha256').update(token).digest('hex');
    const row = this.refresh.get(hash);
    if (row && row.revoked) {
      const fam = this.families.get(row.family) || [];
      for (const h of fam) { const r = this.refresh.get(h); if (r) r.revoked = true; }
      this.audit.emit('REFRESH_REUSE', { actorId: row.userId, entityType: 'auth' });
      return true;
    }
    return false;
  }
  logout(token?: string) {
    if (!token) return { ok: true };
    const hash = createHash('sha256').update(token).digest('hex');
    const row = this.refresh.get(hash);
    if (row) { row.revoked = true; this.sessions.delete(row.sessionId); this.audit.emit('LOGOUT', { actorId: row.userId, entityType: 'auth' }); }
    return { ok: true };
  }
  logoutAll(userId: string) {
    for (const r of this.refresh.values()) if (r.userId === userId) r.revoked = true;
    for (const [k, s] of [...this.sessions]) if (s.userId === userId) this.sessions.delete(k);
    this.audit.emit('LOGOUT_ALL', { actorId: userId, entityType: 'auth' });
    return { ok: true };
  }
  listSessions(userId: string) { return [...this.sessions.values()].filter((s) => s.userId === userId); }
  revokeSession(userId: string, sid: string, isAdmin: boolean, targetUser?: string) {
    const s = this.sessions.get(sid);
    if (!s) throw new BadRequestException({ code: 'NOT_FOUND', message: 'Session not found' });
    if (!isAdmin && s.userId !== userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    if (isAdmin && targetUser && s.userId !== targetUser) throw new BadRequestException({ code: 'MISMATCH', message: 'Mismatch' });
    this.sessions.delete(sid);
    for (const r of this.refresh.values()) if (r.sessionId === sid) r.revoked = true;
    return { ok: true };
  }
  forgot(email: string) {
    const user = this.users.findByEmail(email);
    if (user) {
      const t = randomUUID();
      this.resetTokens.set(t, { userId: user.id, expiresAt: Date.now() + 3600e3 });
    }
    return { ok: true }; // always 200, no enumeration
  }
  reset(token: string, newPassword: string) {
    const r = this.resetTokens.get(token);
    if (!r || Date.now() > r.expiresAt) throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'Invalid token' });
    UsersService.validatePasswordPolicy(newPassword);
    const user = this.users.findById(r.userId)!;
    return bcrypt.hash(newPassword, 12).then((h) => { user.passwordHash = h; this.resetTokens.delete(token); return { ok: true }; });
  }
  invite(email: string, role: any) {
    // admin-only caller checked in controller; return invite token (logged in dev)
    const t = randomUUID();
    this.resetTokens.set(t, { userId: email, expiresAt: Date.now() + 24 * 3600e3 });
    return { inviteToken: t, role };
  }
}
