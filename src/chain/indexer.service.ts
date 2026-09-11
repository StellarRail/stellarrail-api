import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentsService } from '../payments/payments.service';
import { StellarService } from './stellar.service';
@Injectable()
export class IndexerService {
  constructor(private payments: PaymentsService, private stellar: StellarService) {}
  async pollOnce(): Promise<number> {
    let n = 0;
    for (const p of this.payments.allRaw()) {
      const h = p.escrowTxHash || p.releaseTxHash || p.refundTxHash;
      if (!h || p.onChainStatus === 'CONFIRMED') continue;
      try {
        const r = await this.stellar.getTransaction(h);
        if (r.status === 'SUCCESS') { p.onChainStatus = 'CONFIRMED'; p.ledger = r.ledger; p.confirmedAt = new Date(); n++; }
        else { p.onChainStatus = 'FAILED'; n++; }
      } catch { /* keep queued */ }
    }
    return n;
  }
  @Cron('*/30 * * * * *')
  async cron() { await this.pollOnce(); }
}
