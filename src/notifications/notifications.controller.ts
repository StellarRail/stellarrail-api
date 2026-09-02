import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@ApiTags('notifications') @ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private n: NotificationsService) {}
  @Get() @UseGuards(JwtAuthGuard) list() { return this.n.list(); }
  @Post(':id/read') @UseGuards(JwtAuthGuard) read(@Param('id') id: string) { return this.n.markRead(id); }
}
