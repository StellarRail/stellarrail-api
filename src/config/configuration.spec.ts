import { validateEnv } from './configuration';
describe('env validation', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    STELLAR_NETWORK: 'testnet',
    HORIZON_URL: 'https://horizon-testnet.stellar.org',
    SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
    ESCROW_CONTRACT_ID: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
    KMS_PROVIDER: 'local',
  } as any;
  it('accepts valid env', () => { expect(() => validateEnv({ ...base })).not.toThrow(); });
  it('rejects missing secret', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });
  it('rejects mainnet without confirm', () => {
    expect(() => validateEnv({ ...base, STELLAR_NETWORK: 'mainnet' })).toThrow(/CONFIRM_MAINNET/);
  });
});
describe('mainnet-guard', () => {
  it('mainnet guard enforced', () => {
    expect(() => validateEnv({ ...( { DATABASE_URL: 'x', REDIS_URL: 'y', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), STELLAR_NETWORK: 'mainnet', HORIZON_URL: 'https://h.stellar.org', SOROBAN_RPC_URL: 'https://s.stellar.org', ESCROW_CONTRACT_ID: 'C0123456789', KMS_PROVIDER: 'aws' } as any) })).toThrow();
  });
});
