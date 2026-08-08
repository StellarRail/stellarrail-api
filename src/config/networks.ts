export const NETWORKS = {
  dev: { stellar: 'testnet', horizon: 'https://horizon-testnet.stellar.org' },
  staging: { stellar: 'testnet', horizon: 'https://horizon-testnet.stellar.org', anonymized: true },
  prod: { stellar: 'mainnet', horizon: 'https://horizon.stellar.org' },
} as const;
