const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function isValidAddress(addr: string): boolean {
  if (typeof addr !== 'string' || addr.length !== 56) return false;
  if (addr[0] !== 'G') return false;
  for (const c of addr) if (!B32.includes(c)) return false;
  return true;
}

export function xlmToStroops(xlm: string): bigint {
  if (!/^-?\d+(\.\d{1,7})?$/.test(xlm)) throw Object.assign(new Error('INVALID_PRECISION'), { code: 'INVALID_PRECISION' });
  const [w, f = ''] = xlm.split('.');
  const frac = (f + '0000000').slice(0, 7);
  return BigInt(w) * BigInt(10_000_000) + BigInt((w.startsWith('-') ? '-' : '') + frac.replace('-', ''));
}

export function stroopsToXlm(s: bigint | string): string {
  const b = BigInt(s);
  const neg = b < BigInt(0);
  const abs = neg ? -b : b;
  const whole = abs / BigInt(10_000_000);
  const frac = (abs % BigInt(10_000_000)).toString().padStart(7, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole.toString()}${frac ? '.' + frac : ''}`;
}

export function formatXlm(s: bigint | string): string { return `${stroopsToXlm(s)} XLM`; }

export function isValidMemo(m?: string): boolean {
  if (m === undefined) return true;
  return typeof m === 'string' && m.length <= 28;
}
