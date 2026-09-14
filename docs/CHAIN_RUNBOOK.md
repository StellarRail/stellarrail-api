# Chain runbook

RPC down: 1) check /api/v1/health/chain 2) jobs queue in BullMQ, DLQ chain-dlq 3) wait for circuit 60s 4) manual CLI: ts-node scripts/chain-smoke.ts. Manual release: POST /api/v1/payments/:id/retry.
