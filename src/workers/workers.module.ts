import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { WorkersService } from './workers.service';
@Module({ providers: [QueueService, WorkersService], exports: [QueueService, WorkersService] })
export class WorkersModule {}
