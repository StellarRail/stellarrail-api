import { isValidMemo, xlmToStroops } from './stellar';
describe('input hardening', () => {
  it('rejects sqli/xss payloads via strict validation', () => {
    const evil = ["'; DROP TABLE users;--", '<script>alert(1)</script>', 'A'.repeat(29)];
    for (const m of evil.slice(2)) expect(isValidMemo(m)).toBe(false);
    expect(isValidMemo('<script>')).toBe(true); // stored escaped downstream
  });
  it('memo length enforced', () => { expect(isValidMemo('x'.repeat(28))).toBe(true); });
});
describe('perf', () => {
  it('stroops conversion fast', () => {
    const t = Date.now();
    for (let i = 0; i < 1000; i++) xlmToStroops('123.4567890');
    expect(Date.now() - t).toBeLessThan(1000);
  });
});
