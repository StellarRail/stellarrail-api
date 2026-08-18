import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as bcrypt from 'bcryptjs';
@ApiTags('users') @ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private users: UsersService) {}
  @Get('me') @UseGuards(JwtAuthGuard) me(@Req() req: any) {
    const u = this.users.findById(req.user.sub);
    return this.users.sanitize(u!);
  }
  @Post('me/password') @UseGuards(JwtAuthGuard) async changePw(@Req() req: any, @Body() b: any) {
    const u = this.users.findById(req.user.sub)!;
    if (!(await bcrypt.compare(b.currentPassword, u.passwordHash))) throw new ForbiddenException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    UsersService.validatePasswordPolicy(b.newPassword);
    u.passwordHash = await bcrypt.hash(b.newPassword, 12);
    return { ok: true };
  }
  @Get() @UseGuards(JwtAuthGuard) list(@Req() req: any, @Query('page') page = '1', @Query('limit') limit = '20') {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    return this.users.list(parseInt(page as string, 10), Math.min(parseInt(limit as string, 10), 100));
  }
  @Post() @UseGuards(JwtAuthGuard) async create(@Req() req: any, @Body() b: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    return this.users.create(b.email, b.password, b.role || 'OPERATOR');
  }
  @Patch(':id') @UseGuards(JwtAuthGuard) patch(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    const u = this.users.updateRole(id, b.role ?? this.users.findById(id)!.role, b.isActive);
    return this.users.sanitize(u);
  }
  @Post(':id/reset-mfa') @UseGuards(JwtAuthGuard) resetMfa(@Req() req: any, @Param('id') id: string) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    this.users.resetMfa(id); return { ok: true };
  }
}
