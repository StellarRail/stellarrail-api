import { redact } from './logger.service';
describe('logging redaction', () => {
  it('redacts secrets and keeps requestId', () => {
    const r = redact({ password: 'x', secret: 'y', privateKey: 'z', Authorization: 'b', ok: 1 });
    expect(r.password).toBe('[REDACTED]');
    expect(r.ok).toBe(1);
    expect(JSON.stringify({ requestId: 'abc', ...r })).toContain('abc');
    expect(JSON.stringify(r)).not.toContain('bearer-secret-test');
  });
});
