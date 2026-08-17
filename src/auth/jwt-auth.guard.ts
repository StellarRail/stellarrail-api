import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing token' });
    try {
      const payload: any = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-chars-long-xxxx');
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    }
  }
}
