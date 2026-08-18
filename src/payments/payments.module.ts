import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StateMachine } from './state-machine';
import { IdempotencyService } from './idempotency.service';
import { BlocklistService } from './blocklist.service';
import { LimitsService } from './limits.service';
import { ExpiryService } from './expiry.service';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChainModule } from '../chain/chain.module';
import { ConfigController } from './config.controller';
import { SystemConfigService } from '../config/system-config.service';
@Module({
  imports: [UsersModule, AuditModule, NotificationsModule, forwardRef(() => ChainModule)],
  controllers: [PaymentsController, ConfigController],
  providers: [PaymentsService, StateMachine, IdempotencyService, BlocklistService, LimitsService, ExpiryService, SystemConfigService],
  exports: [PaymentsService, StateMachine, IdempotencyService, BlocklistService, SystemConfigService],
})
export class PaymentsModule {}
