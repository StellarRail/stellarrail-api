import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
@Injectable()
export class ReadonlyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const method = req.method;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return true;
    if (process.env.MAINTENANCE_READONLY === 'true' || (global as any).__READONLY__) {
      const p = req.path || req.url || '';
      if (p.includes('/admin/config') && method === 'PUT') return true;
      throw new HttpException({ code: 'READ_ONLY_MODE', message: 'System in read-only mode' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return true;
  }
}
