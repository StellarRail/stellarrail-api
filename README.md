# stellarrail-api

[![CI](https://github.com/StellarRail/stellarrail-api/actions/workflows/ci.yml/badge.svg)](https://github.com/StellarRail/stellarrail-api/actions/workflows/ci.yml)
[![Docker](https://github.com/StellarRail/stellarrail-api/actions/workflows/docker.yml/badge.svg)](https://github.com/StellarRail/stellarrail-api/actions/workflows/docker.yml)
[![Gitleaks](https://github.com/StellarRail/stellarrail-api/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/StellarRail/stellarrail-api/actions/workflows/gitleaks.yml)

Payment orchestration API for StellarRail — JWT + MFA auth, 3-role RBAC
(Admin/Operator/Approver), maker-checker payment workflow, KMS-backed
Soroban signing, and BullMQ reconciliation workers.

- **Stack:** NestJS 10 · Node 20 · Postgres 15 (Prisma 5) · Redis 7 / BullMQ 5 · `stellar-sdk` v11
- **Version:** `1.0.0-rc1` · License: Apache-2.0
- **Org docs:** [profile](https://github.com/StellarRail/.github/blob/main/profile/README.md) ·
  [architecture](https://github.com/StellarRail/.github/blob/main/docs/ARCHITECTURE.md) ·
  [contributing](https://github.com/StellarRail/.github/blob/main/CONTRIBUTING.md) ·
  [security](https://github.com/StellarRail/.github/blob/main/SECURITY.md)

## Quickstart (< 5 min)

```bash
cp .env.example .env
docker compose up -d          # postgres:5432 + redis:6379
npm install
npx prisma migrate dev
npm run seed                  # dev-only demo users (see below)
npm run start:dev             # http://localhost:3000/docs (Swagger)
```

Demo logins (dev only): `admin` / `operator` / `approver`
`@stellarrail.local` — password `*Pass12345!` each.

## Configuration

Required env (see `.env.example` + `src/config/configuration.ts` Zod validation):

| Var | Example |
|---|---|
| `DATABASE_URL` | `postgresql://stellar:stellar@localhost:5432/stellarrail?schema=public` |
| `REDIS_URL` | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥ 32 chars, distinct |
| `HORIZON_URL` | `https://horizon-testnet.stellar.org` |
| `SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `ESCROW_CONTRACT_ID` | `CDAV32AHVV6Q7FFNPUFA76AARTGWBE2QFIU3WAPDV64QIBRTGUFKLU2K` (testnet) |

Optional: `PORT=3000`, `STELLAR_NETWORK=testnet`, `KMS_PROVIDER=local`,
`CORS_ORIGINS`, `CHAIN_DRY_RUN=true` (default safe), `ALLOW_LOCAL_SIGNER`,
`SEED_DEMO`, `AUTO_REFUND_ON_EXPIRY`, `DEFAULT_DEADLINE_HOURS=24`.
Mainnet additionally requires `CONFIRM_MAINNET=I_UNDERSTAND_REAL_FUNDS`;
raw `PRIVATE_KEY`/`MNEMONIC` are forbidden in prod.

## API surface (`/api/v1`)

- `health`: `GET /health`, `/health/live`, `/health/ready`, `/health/db`, `/health/redis`, `/health/chain`, `GET /metrics`
- `auth`: `POST /auth/login|invite|mfa/enroll|mfa/verify|mfa/login|refresh|logout|logout-all|forgot|reset|register`, `GET /auth/sessions`
- `users`: `GET /users/me`, `POST /users/me/password`, `DELETE /users/me` (GDPR anonymize), `GET|POST /users`, `PATCH /users/:id`
- `payments`: `POST /payments` (needs `Idempotency-Key`), `GET /payments`, `GET /payments/stats`, `GET|PATCH|DELETE /payments/:id`, `GET /payments/:id/timeline`, `POST /payments/:id/{approve,reject,retry,refund}`
- `chain`: `GET /chain/info` · `audit`: `GET /audit`, `GET /audit/export`
- `admin`: `POST /admin/reconcile`, `GET /admin/reconciliation`, `GET /admin/queues` · `notifications`: `GET /notifications`

Conventions: access tokens 15 min + 7-day rotating refresh; SoD enforced
(operator ≠ approver → `403 SOD_VIOLATION`); idempotency conflicts → `409`.
Full reference in [`docs/API.md`](./docs/API.md) + Swagger `/docs`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run start:dev` / `start` / `start:prod` | dev watch / prod `node dist/main` |
| `npm run build` | `nest build` (Docker prod stage) |
| `npm test` / `test:coverage` | Jest unit (`test/jest-unit.json`) |
| `npm run test:e2e` / `test:e2e:ci` | e2e (`CHAIN_DRY_RUN=true` in CI) |
| `npm run lint` / `format` / `typecheck` | eslint / prettier / `tsc --noEmit` |
| `npm run seed` | `prisma/seed.ts` demo data |
| `npm run chain:smoke` | dry-run chain smoke |
| `npm run openapi:export` | regenerate `openapi.json` |
| `npm run dev:up` / `docker:build` | compose up / image build |

## Docs

Local runbooks: [`docs/API.md`](./docs/API.md) ·
[`docs/RUNBOOK.md`](./docs/RUNBOOK.md) ·
[`docs/CHAIN.md`](./docs/CHAIN.md) ·
[`docs/CHAIN_RUNBOOK.md`](./docs/CHAIN_RUNBOOK.md) ·
[`docs/DEPLOY.md`](./docs/DEPLOY.md) ·
[`docs/PRODUCTION.md`](./docs/PRODUCTION.md) ·
[`docs/SECURITY_REVIEW.md`](./docs/SECURITY_REVIEW.md) ·
[`docs/SECRETS.md`](./docs/SECRETS.md) ·
[`docs/DISASTER_RECOVERY.md`](./docs/DISASTER_RECOVERY.md) ·
[`docs/ALERTING.md`](./docs/ALERTING.md) ·
[`docs/GDPR.md`](./docs/GDPR.md) ·
[`docs/PERF.md`](./docs/PERF.md)

Org-wide: [contributing](https://github.com/StellarRail/.github/blob/main/CONTRIBUTING.md) ·
[code of conduct](https://github.com/StellarRail/.github/blob/main/CODE_OF_CONDUCT.md) ·
[support](https://github.com/StellarRail/.github/blob/main/SUPPORT.md).
Security reports go to `security@stellarrail.example` — never file them as
public issues.
