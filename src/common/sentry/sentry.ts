export const ERROR_CODES = ['SOD_VIOLATION','RPC_DOWN','REFRESH_REUSE','RECON_MISMATCH','VALIDATION_ERROR','FORBIDDEN'] as const;
export function captureError(code: string, err: unknown, ctx: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (['password','privateKey','mnemonic','secret'].includes(k)) continue;
    safe[k] = v;
  }
  if (process.env.SENTRY_DSN) { /* send to sentry without PII */ }
  return { code, safe, err: err instanceof Error ? err.message : String(err) };
}
