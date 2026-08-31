import { Injectable } from '@nestjs/common';

export interface SystemConfig {
  perTxLimitXlm: number;
  dailyLimitPerRole: Record<string, number>;
  approvalThreshold: number;
  defaultDeadlineHours: number;
  maintenanceReadOnly: boolean;
}

const DEFAULTS: SystemConfig = {
  perTxLimitXlm: 10000,
  dailyLimitPerRole: { ADMIN: 100000, OPERATOR: 10000, APPROVER: 50000 },
  approvalThreshold: 0,
  defaultDeadlineHours: 24,
  maintenanceReadOnly: false,
};

@Injectable()
export class SystemConfigService {
  private cfg: SystemConfig = { ...DEFAULTS };
  private cachedAt = 0;
  get(): SystemConfig {
    return { ...this.cfg };
  }
  update(patch: Partial<SystemConfig>): SystemConfig {
    this.cfg = { ...this.cfg, ...patch };
    this.cachedAt = Date.now();
    return this.get();
  }
  getCacheAgeMs(): number { return Date.now() - this.cachedAt; }
}
