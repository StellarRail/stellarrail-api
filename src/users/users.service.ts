import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
export type Role = 'ADMIN' | 'OPERATOR' | 'APPROVER';
export interface User { id: string; email: string; passwordHash: string; role: Role; mfaSecret?: string; mfaEnabled: boolean; backupCodes: string[]; isActive: boolean; createdAt: Date; }
const COMMON = new Set(['password123', 'password1234', '123456789012', 'qwerty123456', 'letmein12345']);
@Injectable()
export class UsersService {
  private users = new Map<string, User>();
  private byEmail = new Map<string, string>();
  constructor() {
    this.seedSync();
  }
  private seedSync() {
    const mk = (email: string, role: Role) => {
      if (this.byEmail.has(email.toLowerCase())) return;
      const pw = email.startsWith('admin') ? 'AdminPass12345!' : email.startsWith('operator') ? 'OperatorPass12345!' : 'ApproverPass12345!';
      const u: User = { id: email, email, passwordHash: bcrypt.hashSync(pw, 4), role, mfaEnabled: false, backupCodes: [], isActive: true, createdAt: new Date() };
      this.users.set(u.id, u); this.byEmail.set(email.toLowerCase(), u.id);
    };
    mk('admin@stellarrail.local', 'ADMIN');
    mk('operator@stellarrail.local', 'OPERATOR');
    mk('approver@stellarrail.local', 'APPROVER');
  }
  static validatePasswordPolicy(pw: string) {
    if (typeof pw !== 'string' || pw.length < 12) throw new BadRequestException({ code: 'WEAK_PASSWORD', message: 'Password must be >=12 chars' });
    if (COMMON.has(pw.toLowerCase())) throw new BadRequestException({ code: 'WEAK_PASSWORD', message: 'Password too common' });
  }
  async hash(pw: string): Promise<string> { return bcrypt.hash(pw, 12); }
  async create(email: string, password: string, role: Role = 'OPERATOR'): Promise<Omit<User, 'passwordHash'>> {
    UsersService.validatePasswordPolicy(password);
    if (this.byEmail.has(email.toLowerCase())) throw new BadRequestException({ code: 'EMAIL_TAKEN', message: 'Email taken' });
    const u: User = { id: randomUUID(), email, passwordHash: await this.hash(password), role, mfaEnabled: false, backupCodes: [], isActive: true, createdAt: new Date() };
    this.users.set(u.id, u); this.byEmail.set(email.toLowerCase(), u.id);
    const { passwordHash: _, ...safe } = u; return safe as any;
  }
  findByEmail(email: string): User | undefined { const id = this.byEmail.get(email.toLowerCase()); return id ? this.users.get(id) : undefined; }
  findById(id: string): User | undefined { return this.users.get(id); }
  list(page = 1, limit = 20) {
    const all = [...this.users.values()].map((u) => { const { passwordHash: _, ...s } = u; return s; });
    return { data: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit };
  }
  updateRole(id: string, role: Role, isActive?: boolean) {
    const u = this.users.get(id); if (!u) throw new NotFoundException('User not found');
    u.role = role; if (isActive !== undefined) u.isActive = isActive; return u;
  }
  resetMfa(id: string) { const u = this.users.get(id); if (!u) throw new NotFoundException('User not found'); u.mfaEnabled = false; u.mfaSecret = undefined; u.backupCodes = []; }
  anonymize(id: string) { const u = this.users.get(id); if (!u) throw new NotFoundException('User not found'); u.email = `deleted-${u.id}@deleted.local`; (u as any).passwordHash = 'deleted'; u.isActive = false; }
  sanitize(u: User) { const { passwordHash: _, ...s } = u; return s; }
  count() { return this.users.size; }
}
