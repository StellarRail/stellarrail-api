import { Injectable } from '@nestjs/common';
const REDACT = ['password', 'secret', 'privatekey', 'authorization', 'mnemonic'];
export function redact(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACT.includes(k.toLowerCase()) ? '[REDACTED]' : (typeof v === 'object' ? redact(v) : v);
  }
  return out;
}
@Injectable()
export class LoggerService {
  log(msg: string, meta: any = {}, requestId = '-') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: 'info', msg, requestId, ...redact(meta) }));
  }
}
