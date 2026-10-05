# Runbook

1. API 5xx spike: check Sentry, `docker compose logs api`. 2. Queue stuck: /admin/queues depths, restart worker. 3. Recon mismatch: GET /admin/reconciliation, review needsReview payments. 4. RPC down: see CHAIN_RUNBOOK. 5. DB down: RDS failover, PITR. 6. Key rotation (quarterly): create new KMS key, deploy, verify sign, deprecate old.

Copy-paste: `docker compose logs -f api`, `curl localhost:3000/api/v1/health`, `npm run test:e2e:ci`.
