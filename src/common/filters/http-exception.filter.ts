import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    const requestId = req?.requestId || req?.headers?.['x-request-id'] || 'unknown';
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body: any = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        code = body.code || body.error || code;
        message = Array.isArray(body.message) ? body.message.join('; ') : body.message || message;
        if (status === 400 && !body.code) code = 'VALIDATION_ERROR';
        if (status === 429) code = 'RATE_LIMITED';
      } else { message = String(body); }
    }
    res.status(status).json({ statusCode: status, code, message, requestId });
  }
}
