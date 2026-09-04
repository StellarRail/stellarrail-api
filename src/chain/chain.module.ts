import { Module, forwardRef } from '@nestjs/common';
import { SignerService } from './signer.service';
import { StellarService } from './stellar.service';
import { OrchestrationService } from './orchestration.service';
import { IndexerService } from './indexer.service';
import { ReconcileService } from './reconcile.service';
import { ChainController } from './chain.controller';
import { PaymentsModule } from '../payments/payments.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [forwardRef(() => PaymentsModule), AuditModule, NotificationsModule],
  controllers: [ChainController],
  providers: [SignerService, StellarService, OrchestrationService, IndexerService, ReconcileService],
  exports: [SignerService, StellarService, OrchestrationService, IndexerService, ReconcileService],
})
export class ChainModule {}
