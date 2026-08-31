import { Controller, Get, Put, Body, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemConfigService } from '../config/system-config.service';
import { AuditService } from '../audit/audit.service';
@ApiTags('admin') @ApiBearerAuth()
@Controller({ path: 'config', version: '1' })
export class ConfigController {
  constructor(private cfg: SystemConfigService, private audit: AuditService) {}
  @Get() @UseGuards(JwtAuthGuard) get(@Req() req: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    return this.cfg.get();
  }
  @Put() @UseGuards(JwtAuthGuard) put(@Req() req: any, @Body() b: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    const out = this.cfg.update(b);
    this.audit.emit('CONFIG_UPDATED', { actorId: req.user.sub, entityType: 'config', payload: b });
    return out;
  }
}
