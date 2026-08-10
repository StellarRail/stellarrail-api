import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const start = Date.now();
    return next.handle().pipe(tap(() => {
      const ms = Date.now() - start;
      res.setHeader('X-Request-Id', req.requestId || 'unknown');
      res.setHeader('X-Duration-Ms', String(ms));
    }));
  }
}
