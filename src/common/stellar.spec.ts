import { isValidAddress, xlmToStroops, stroopsToXlm, isValidMemo } from './stellar';
describe('stellar-utils', () => {
  it('validates addresses', () => {
    expect(isValidAddress('G' + 'A'.repeat(55))).toBe(true);
    expect(isValidAddress('bad')).toBe(false);
    expect(isValidAddress('G' + '!'.repeat(55))).toBe(false);
  });
  it('converts exactly without float error', () => {
    expect(xlmToStroops('0.1')).toBe(BigInt(1_000_000));
    expect(xlmToStroops('0.0000001')).toBe(BigInt(1));
    expect(stroopsToXlm(BigInt(1_000_000))).toBe('0.1');
    expect(() => xlmToStroops('0.00000001')).toThrow();
    expect(() => xlmToStroops('abc')).toThrow();
  });
  it('fuzz never throws unhandled', () => {
    expect(isValidMemo(undefined)).toBe(true);
    for (const v of [null, 123, {}, [], 'A'.repeat(29)] as any[]) {
      expect(isValidMemo(v)).toBe(false);
      expect(isValidAddress(v as any)).toBe(false);
    }
  });
});
