import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { StateMachine, PaymentStatus } from './state-machine';
import { IdempotencyService } from './idempotency.service';
import { BlocklistService } from './blocklist.service';
import { LimitsService } from './limits.service';
import { isValidAddress, xlmToStroops, isValidMemo } from '../common/stellar';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SystemConfigService } from '../config/system-config.service';

export interface Payment { id: string; referenceId: string; requesterId: string; destination: string; amountStroops: string; memo?: string; status: PaymentStatus; version: number; escrowTxHash?: string; releaseTxHash?: string; refundTxHash?: string; onChainStatus?: string; ledger?: number; confirmedAt?: Date; needsReview?: boolean; deadline: Date; idempotencyKey?: string; createdAt: Date; updatedAt: Date; deleted?: boolean; }

const CreateSchema = z.object({
  destination: z.string().min(1),
  amountXlm: z.string().min(1),
  memo: z.string().max(28).optional(),
  referenceId: z.string().regex(/^[A-Za-z0-9-_]{4,64}$/).optional(),
  idempotencyKey: z.string().optional(),
});

@Injectable()
export class PaymentsService {
  private payments = new Map<string, Payment>();
  private byRef = new Map<string, string>();
  dailySpent = new Map<string, bigint>();
  statsCache: { at: number; value: any } | null = null;

  constructor(private sm: StateMachine, private idem: IdempotencyService, private block: BlocklistService, private limits: LimitsService, private audit: AuditService, private notif: NotificationsService, private cfg: SystemConfigService) {}

  create(input: any, requesterId: string, role: string, idemHeader?: string, ip?: string): Payment {
    const parsed = CreateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join('; ') });
    const body = parsed.data;
    if (!isValidAddress(body.destination)) throw new BadRequestException({ code: 'INVALID_ADDRESS', message: 'Invalid Stellar address' });
    if (!isValidMemo(body.memo)) throw new BadRequestException({ code: 'INVALID_MEMO', message: 'Memo too long' });
    let stroops: bigint;
    try { stroops = xlmToStroops(body.amountXlm); } catch { throw new BadRequestException({ code: 'INVALID_PRECISION', message: 'Max 7 decimals' }); }
    if (stroops <= BigInt(0)) throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Amount must be positive' });
    if (this.block.isBlocked(body.destination)) {
      this.audit.emit('ADDRESS_BLOCKED', { actorId: requesterId, entityType: 'payment', ip, payload: { destination: body.destination } });
      throw new HttpException({ code: 'ADDRESS_BLOCKED', message: 'Destination blocked' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    try { this.limits.check(body.amountXlm, role); } catch (e: any) {
      if (e.code === 'LIMIT_EXCEEDED') throw new HttpException({ code: 'LIMIT_EXCEEDED', message: 'Limit exceeded', detail: e.detail }, HttpStatus.UNPROCESSABLE_ENTITY);
      throw e;
    }
    const key = idemHeader || body.idempotencyKey;
    const replay = this.idem.handle(key, body);
    if (replay.replay) return replay.response;
    const now = new Date();
    const c = this.cfg.get();
    const p: Payment = {
      id: randomUUID(), referenceId: body.referenceId || `REF-${randomUUID().slice(0, 8).toUpperCase()}`,
      requesterId, destination: body.destination, amountStroops: stroops.toString(), memo: body.memo,
      status: 'CREATED', version: 1, deadline: new Date(Date.now() + c.defaultDeadlineHours * 3600e3),
      idempotencyKey: key, createdAt: now, updatedAt: now,
    };
    if (this.byRef.has(p.referenceId)) throw new ConflictException({ code: 'DUPLICATE_REFERENCE', message: 'Duplicate referenceId' });
    this.payments.set(p.id, p); this.byRef.set(p.referenceId, p.id);
    this.audit.emit('PAYMENT_CREATED', { actorId: requesterId, entityType: 'payment', entityId: p.id, ip, payload: body });
    this.statsCache = null;
    // async chain progression (dry-run aware) is triggered by ChainModule via hooks; simulate immediate escrow lock scheduling
    this.idem.store(key, body, p);
    return p;
  }

  get(id: string, actorId: string, role: string): Payment {
    const p = this.payments.get(id);
    if (!p || p.deleted) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    if (role === 'OPERATOR' && p.requesterId !== actorId) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    return p;
  }
  list(q: any, actorId: string, role: string) {
    let arr = [...this.payments.values()].filter((p) => !p.deleted);
    if (role === 'OPERATOR') arr = arr.filter((p) => p.requesterId === actorId);
    if (q.status) arr = arr.filter((p) => p.status === q.status);
    if (q.search) arr = arr.filter((p) => p.referenceId.includes(q.search) || p.destination.includes(q.search));
    arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const page = parseInt(q.page || '1', 10); const limit = Math.min(parseInt(q.limit || '20', 10), 100);
    return { data: arr.slice((page - 1) * limit, page * limit), total: arr.length, page, limit };
  }
  stats() {
    if (this.statsCache && Date.now() - this.statsCache.at < 30000) return { ...this.statsCache.value, cached: true };
    const arr = [...this.payments.values()];
    const byStatus: Record<string, number> = {};
    let volume = BigInt(0);
    for (const p of arr) { byStatus[p.status] = (byStatus[p.status] || 0) + 1; volume += BigInt(p.amountStroops); }
    const v = { counts: byStatus, volumeStroops: volume.toString(), total: arr.length };
    this.statsCache = { at: Date.now(), value: v };
    return { ...v, cached: false };
  }
  patch(id: string, body: any, actorId: string): Payment {
    const p = this.payments.get(id);
    if (!p || p.deleted) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    if (p.requesterId !== actorId) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    if (p.status !== 'DRAFT' && p.status !== 'CREATED') throw new ConflictException({ code: 'INVALID_TRANSITION', message: 'Only DRAFT/CREATED editable' });
    if (body.destination) { if (!isValidAddress(body.destination)) throw new BadRequestException({ code: 'INVALID_ADDRESS', message: 'Bad address' }); p.destination = body.destination; }
    if (body.memo !== undefined) { if (!isValidMemo(body.memo)) throw new BadRequestException({ code: 'INVALID_MEMO', message: 'Bad memo' }); p.memo = body.memo; }
    p.updatedAt = new Date(); p.version += 1;
    this.audit.emit('PAYMENT_UPDATED', { actorId, entityType: 'payment', entityId: id, payload: body });
    return p;
  }
  remove(id: string, actorId: string) {
    const p = this.payments.get(id);
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    if (p.status !== 'DRAFT' && p.status !== 'CREATED') throw new ConflictException({ code: 'INVALID_TRANSITION', message: 'Only drafts deletable' });
    p.deleted = true;
    this.audit.emit('PAYMENT_DELETED', { actorId, entityType: 'payment', entityId: id });
    return { ok: true };
  }
  transition(p: Payment, to: PaymentStatus, actorId: string, action: string) {
    this.sm.assert(p.status, to);
    p.status = to; p.updatedAt = new Date(); p.version += 1;
    this.audit.emit(action, { actorId, entityType: 'payment', entityId: p.id, payload: { to } });
    this.statsCache = null;
    return p;
  }
  approve(id: string, actorId: string, role: string): Payment {
    const p = this.payments.get(id);
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    if (!['APPROVER', 'ADMIN'].includes(role)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    if (p.requesterId === actorId && role !== 'ADMIN') {
      this.audit.emit('SOD_BLOCKED', { actorId, entityType: 'payment', entityId: id });
      throw new ForbiddenException({ code: 'SOD_VIOLATION', message: 'Cannot approve own request' });
    }
    if (p.status !== 'PENDING_APPROVAL') throw new ConflictException({ code: 'INVALID_TRANSITION', message: 'Must be PENDING_APPROVAL' });
    this.transition(p, 'SETTLING', actorId, 'PAYMENT_APPROVED');
    this.notif.enqueue('PAYMENT_PENDING', { paymentId: id });
    return p;
  }
  reject(id: string, actorId: string, role: string, body: any): Payment {
    const p = this.payments.get(id);
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    if (!['APPROVER', 'ADMIN'].includes(role)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    if (p.requesterId === actorId && role !== 'ADMIN') {
      this.audit.emit('SOD_BLOCKED', { actorId, entityType: 'payment', entityId: id });
      throw new ForbiddenException({ code: 'SOD_VIOLATION', message: 'Cannot reject own request' });
    }
    if (!body?.reason) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'reason required' });
    if (body.reason === 'OTHER' && (!body.note || body.note.length < 10)) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'note >=10 chars for OTHER' });
    if (p.status !== 'PENDING_APPROVAL') throw new ConflictException({ code: 'INVALID_TRANSITION', message: 'Must be PENDING_APPROVAL' });
    this.transition(p, 'REFUNDING', actorId, 'PAYMENT_REJECTED');
    return p;
  }
  retry(id: string): Payment {
    const p = this.payments.get(id);
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    // re-enqueue semantics: no state change, idempotent
    this.audit.emit('PAYMENT_RETRY', { entityType: 'payment', entityId: id });
    return p;
  }
  timeline(id: string) {
    const p = this.payments.get(id);
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    const events = this.audit.all().filter((r) => r.entityId === id).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return { payment: p, events };
  }
  expireTick(autoRefund: boolean): number {
    let n = 0;
    for (const p of this.payments.values()) {
      if (p.status === 'PENDING_APPROVAL' && p.deadline.getTime() < Date.now()) {
        try { this.transition(p, 'EXPIRED', 'system', 'PAYMENT_EXPIRED'); n++; if (autoRefund) { try { this.transition(p, 'REFUNDING', 'system', 'PAYMENT_AUTO_REFUND'); } catch { /* noop */ } } } catch { /* noop */ }
      }
    }
    return n;
  }
  seed(p: Partial<Payment>): Payment {
    const now = new Date();
    const full: Payment = { id: p.id || randomUUID(), referenceId: p.referenceId || `REF-${randomUUID().slice(0, 8)}`, requesterId: p.requesterId || 'seed', destination: p.destination || ('G' + 'A'.repeat(55)), amountStroops: p.amountStroops || '10000000', status: p.status || 'CREATED', version: 1, deadline: p.deadline || new Date(Date.now() + 24 * 3600e3), createdAt: now, updatedAt: now, ...p } as Payment;
    this.payments.set(full.id, full); this.byRef.set(full.referenceId, full.id);
    return full;
  }
  allRaw() { return [...this.payments.values()]; }
}
