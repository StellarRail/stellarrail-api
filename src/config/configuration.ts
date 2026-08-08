import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >=32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >=32 chars'),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet', 'futurenet', 'standalone']).default('testnet'),
  HORIZON_URL: z.string().url('HORIZON_URL must be URL'),
  SOROBAN_RPC_URL: z.string().url('SOROBAN_RPC_URL must be URL'),
  ESCROW_CONTRACT_ID: z.string().min(10, 'ESCROW_CONTRACT_ID required'),
  KMS_PROVIDER: z.enum(['aws', 'vault', 'local']).default('local'),
  CORS_ORIGINS: z.string().optional(),
  CHAIN_DRY_RUN: z.string().optional(),
  ALLOW_LOCAL_SIGNER: z.string().optional(),
  CONFIRM_MAINNET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function configuration() {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    stellarNetwork: process.env.STELLAR_NETWORK || 'testnet',
  };
}

export function validateEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    // eslint-disable-next-line no-console
    console.error(`FATAL: invalid environment: ${msg}`);
    throw new Error(`Invalid environment: ${msg}`);
  }
  const e = parsed.data;
  if (process.env.NODE_ENV === 'production' && e.KMS_PROVIDER === 'local' && e.ALLOW_LOCAL_SIGNER !== 'true') {
    throw new Error('FATAL: local signer forbidden in production without ALLOW_LOCAL_SIGNER=true');
  }
  if ((process.env.PRIVATE_KEY || process.env.MNEMONIC) && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: raw PRIVATE_KEY/MNEMONIC must not be set in production (use KMS/Vault)');
  }
  if (e.STELLAR_NETWORK === 'mainnet' && e.CONFIRM_MAINNET !== 'I_UNDERSTAND_REAL_FUNDS') {
    throw new Error('FATAL: mainnet boot requires CONFIRM_MAINNET=I_UNDERSTAND_REAL_FUNDS');
  }
  return e;
}
