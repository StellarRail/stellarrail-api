import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ChainModule } from '../chain/chain.module';
import { PaymentsModule } from '../payments/payments.module';
@Module({ imports: [ChainModule, PaymentsModule], controllers: [AdminController] })
export class AdminModule {}
