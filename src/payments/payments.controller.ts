import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Headers, UseGuards, Res, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@ApiTags('payments') @ApiBearerAuth()
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private svc: PaymentsService) {}
  @Post() @UseGuards(JwtAuthGuard) create(@Body() b: any, @Req() req: any, @Headers('idempotency-key') hk: string) {
    if (!['OPERATOR', 'ADMIN'].includes(req.user.role)) { throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' }); }
    return this.svc.create(b, req.user.sub, req.user.role, hk || b.idempotencyKey, req.ip);
  }
  @Get() @UseGuards(JwtAuthGuard) list(@Query() q: any, @Req() req: any) {
    return this.svc.list(q, req.user.sub, req.user.role);
  }
  @Get('stats') @UseGuards(JwtAuthGuard) stats(@Res({ passthrough: true }) res: any) {
    const s = this.svc.stats();
    res.setHeader('X-Cache', s.cached ? 'HIT' : 'MISS');
    res.setHeader('ETag', `W/"stats-${s.total}"`);
    return s;
  }
  @Get(':id') @UseGuards(JwtAuthGuard) get(@Param('id') id: string, @Req() req: any) { return this.svc.get(id, req.user.sub, req.user.role); }
  @Get(':id/timeline') @UseGuards(JwtAuthGuard) timeline(@Param('id') id: string) { return this.svc.timeline(id); }
  @Patch(':id') @UseGuards(JwtAuthGuard) patch(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.svc.patch(id, b, req.user.sub); }
  @Delete(':id') @UseGuards(JwtAuthGuard) remove(@Param('id') id: string, @Req() req: any) { return this.svc.remove(id, req.user.sub); }
  @Post(':id/approve') @UseGuards(JwtAuthGuard) approve(@Param('id') id: string, @Req() req: any) { return this.svc.approve(id, req.user.sub, req.user.role); }
  @Post(':id/reject') @UseGuards(JwtAuthGuard) reject(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.svc.reject(id, req.user.sub, req.user.role, b); }
  @Post(':id/retry') @UseGuards(JwtAuthGuard) retry(@Param('id') id: string) { return this.svc.retry(id); }
  @Post(':id/refund') @UseGuards(JwtAuthGuard) refund(@Param('id') id: string, @Req() req: any) {
    if (req.user.role !== 'ADMIN') { throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' }); }
    const p = this.svc.get(id, req.user.sub, req.user.role);
    try { return this.svc.transition(p, 'REFUNDING', req.user.sub, 'PAYMENT_MANUAL_REFUND'); } catch { return p; }
  }
}
