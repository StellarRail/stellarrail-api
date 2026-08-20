import { Injectable } from '@nestjs/common';
import { SystemConfigService } from '../config/system-config.service';
import { xlmToStroops } from '../common/stellar';
@Injectable()
export class LimitsService {
  constructor(private cfg: SystemConfigService) {}
  check(amountXlm: string, role: string) {
    const c = this.cfg.get();
    const stroops = xlmToStroops(amountXlm);
    const limitS = BigInt(Math.round(c.perTxLimitXlm * 10_000_000));
    if (stroops > limitS) {
      const e: any = new Error('LIMIT_EXCEEDED'); e.code = 'LIMIT_EXCEEDED'; e.status = 422; e.detail = { limitXlm: c.perTxLimitXlm };
      throw e;
    }
    return true;
  }
}
