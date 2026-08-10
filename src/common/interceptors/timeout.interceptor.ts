import { Injectable, NestInterceptor, ExecutionContext, CallHandler, RequestTimeoutException } from '@nestjs/common';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private ms = 10000) {}
  intercept(_c: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(timeout(this.ms), catchError((e) => e instanceof TimeoutError ? throwError(() => new RequestTimeoutException('TIMEOUT')) : throwError(() => e)));
  }
}
