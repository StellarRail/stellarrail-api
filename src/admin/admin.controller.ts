import { Controller, Get, Post, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReconcileService } from '../chain/reconcile.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@ApiTags('admin') @ApiBearerAuth()
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private rec: ReconcileService) {}
  private needAdmin(req: any) { if (req.user.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' }); }
  @Post('reconcile') @UseGuards(JwtAuthGuard) async recon(@Req() req: any) { this.needAdmin(req); return this.rec.run(1); }
  @Get('reconciliation') @UseGuards(JwtAuthGuard) runs(@Req() req: any) { this.needAdmin(req); return this.rec.runs; }
  @Get('queues') @UseGuards(JwtAuthGuard) queues(@Req() req: any) {
    this.needAdmin(req);
    if (process.env.BULLBOARD_ENABLED !== 'true' && process.env.NODE_ENV === 'production') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Board disabled' });
    return { queues: ['payments', 'reconciliation', 'notifications'] };
  }
}
