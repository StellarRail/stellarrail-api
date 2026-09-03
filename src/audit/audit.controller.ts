import { Controller, Get, Query, Req, UseGuards, ForbiddenException, Header, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@ApiTags('audit') @ApiBearerAuth()
@Controller({ path: 'audit', version: '1' })
export class AuditController {
  constructor(private audit: AuditService) {}
  @Get() @UseGuards(JwtAuthGuard) list(@Req() req: any, @Query() q: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    return this.audit.list({ action: q.action, entityId: q.entityId, page: parseInt(q.page || '1', 10), limit: parseInt(q.limit || '20', 10) });
  }
  @Get('export') @UseGuards(JwtAuthGuard) exp(@Req() req: any, @Query('format') format = 'json', @Res({ passthrough: true }) res: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    if (format === 'csv') { res.setHeader('Content-Disposition', 'attachment; filename="audit.csv"'); return this.audit.exportCsv(); }
    return this.audit.all().slice(0, 10000);
  }
}
