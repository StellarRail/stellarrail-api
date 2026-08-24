import { Injectable, ConflictException } from '@nestjs/common';
export type PaymentStatus = 'DRAFT' | 'CREATED' | 'LOCKED_IN_ESCROW' | 'PENDING_APPROVAL' | 'SETTLING' | 'SETTLED' | 'REFUNDING' | 'REFUNDED' | 'FAILED' | 'EXPIRED' | 'TIMEOUT';
const ALLOWED: Record<PaymentStatus, PaymentStatus[]> = {
  DRAFT: ['CREATED'],
  CREATED: ['LOCKED_IN_ESCROW', 'FAILED', 'TIMEOUT'],
  LOCKED_IN_ESCROW: ['PENDING_APPROVAL', 'FAILED', 'TIMEOUT'],
  PENDING_APPROVAL: ['SETTLING', 'REFUNDING', 'EXPIRED', 'FAILED', 'TIMEOUT'],
  SETTLING: ['SETTLED', 'FAILED', 'TIMEOUT'],
  SETTLED: [],
  REFUNDING: ['REFUNDED', 'FAILED', 'TIMEOUT'],
  REFUNDED: [],
  FAILED: [],
  EXPIRED: ['REFUNDING'],
  TIMEOUT: [],
};
@Injectable()
export class StateMachine {
  can(from: PaymentStatus, to: PaymentStatus): boolean { return (ALLOWED[from] || []).includes(to); }
  assert(from: PaymentStatus, to: PaymentStatus) {
    if (!this.can(from, to)) throw new ConflictException({ code: 'INVALID_TRANSITION', message: `Illegal transition ${from} -> ${to}` });
  }
}
