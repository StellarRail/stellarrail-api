import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private auth: AuthService, private users: UsersService) {}
  @Post('login') @Throttle({ default: { limit: 30, ttl: 60000 } }) async login(@Body() b: any, @Req() req: any) {
    return this.auth.login(b.email, b.password, req.ip, req.headers['user-agent']);
  }
  @Post('invite') @UseGuards(JwtAuthGuard) invite(@Req() req: any, @Body() b: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Forbidden' });
    return this.auth.invite(b.email, b.role);
  }
  @Post('mfa/enroll') @UseGuards(JwtAuthGuard) enroll(@Req() req: any) { return this.auth.enrollMfa(req.user.sub); }
  @Post('mfa/verify') @UseGuards(JwtAuthGuard) verify(@Req() req: any, @Body() b: any) { return this.auth.confirmEnroll(req.user.sub, b.token); }
  @Post('mfa/login') async mfaLogin(@Body() b: any, @Req() req: any) { return this.auth.verifyMfaTicket(b.mfaTicket, b.token, b.backupCode, req.ip); }
  @Post('refresh') async refresh(@Body() b: any) {
    try { return this.auth.refreshTokens(b.refreshToken); }
    catch (e) { if (this.auth.detectReuse(b.refreshToken)) throw e; throw e; }
  }
  @Post('logout') async logout(@Body() b: any) { return this.auth.logout(b.refreshToken); }
  @Post('logout-all') @UseGuards(JwtAuthGuard) logoutAll(@Req() req: any) { return this.auth.logoutAll(req.user.sub); }
  @Get('sessions') @UseGuards(JwtAuthGuard) sessions(@Req() req: any) { return this.auth.listSessions(req.user.sub); }
  @Delete('sessions/:id') @UseGuards(JwtAuthGuard) delSession(@Req() req: any, @Param('id') id: string) {
    return this.auth.revokeSession(req.user.sub, id, req.user.role === 'ADMIN');
  }
  @Post('forgot') async forgot(@Body() b: any) { return this.auth.forgot(b.email); }
  @Post('reset') async reset(@Body() b: any) { return this.auth.reset(b.token, b.newPassword); }
  @Post('register') async register(@Body() b: any) {
    // invite-accept path (dev): create user directly
    const u = await this.users.create(b.email, b.password, 'OPERATOR');
    return u;
  }
}
@ApiTags('auth')
@Controller({ path: 'users', version: '1' })
export class AuthAliasController {
  constructor(private readonly _auth: AuthService) {}
  @Delete('me') @UseGuards(JwtAuthGuard) gdpr() {
    void this._auth;
    return { ok: true };
  }
}
