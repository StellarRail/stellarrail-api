# Production checklist

- [x] envs set (DATABASE_URL, REDIS_URL, JWT secrets 32+, HORIZON/SOROBAN URLs, ESCROW_CONTRACT_ID)
- [x] KMS_PROVIDER=aws|vault, no raw keys, CONFIRM_MAINNET set for mainnet
- [x] migrations: `npm run db:migrate:deploy` in release phase
- [x] Sentry DSN, /metrics restricted, Prometheus scraping
- [x] backups/PITR enabled (see DISASTER_RECOVERY)
- [x] load test evidence (see PERF)
- [x] security review ticked (see SECURITY_REVIEW)
