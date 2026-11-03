<p align="center">
  <img src="assets/banner.svg" alt="StellarRail API Banner" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/StellarRail/stellarrail-api/actions/workflows/ci.yml"><img src="https://github.com/StellarRail/stellarrail-api/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/StellarRail/stellarrail-api/actions/workflows/docker.yml"><img src="https://github.com/StellarRail/stellarrail-api/actions/workflows/docker.yml/badge.svg" alt="Docker" /></a>
  <a href="https://github.com/StellarRail/stellarrail-api/actions/workflows/gitleaks.yml"><img src="https://github.com/StellarRail/stellarrail-api/actions/workflows/gitleaks.yml/badge.svg" alt="Gitleaks" /></a>
  <a href="https://github.com/StellarRail/stellarrail-api/actions/workflows/codeql.yml"><img src="https://github.com/StellarRail/stellarrail-api/actions/workflows/codeql.yml/badge.svg" alt="CodeQL" /></a>
  <img src="https://img.shields.io/badge/NestJS-10.0-E0234E?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Node-20_LTS-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Postgres-15-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License" />
</p>

---

## Overview

**StellarRail API** is the enterprise payment orchestration backend for StellarRail. Built with NestJS 10 and TypeScript, it interfaces directly with the Soroban smart contract escrow engine to manage institutional payments, enforce strict segregation of duties (Maker-Checker), and ensure zero-drift ledger reconciliation:

- **Maker-Checker Workflows**: Segregation of Duties (SoD) enforced at the API gateway layer — operators initiate payments, independent approvers approve/reject (`403 SOD_VIOLATION` if author == approver).
- **Institutional Key Management (KMS)**: Soroban transaction signing backed by AWS KMS, Vault, or isolated local HSM signers.
- **Asynchronous Reconciliation**: BullMQ background workers monitoring Stellar Testnet and Mainnet ledgers, syncing escrow locks, settlements, and refund events in real time.
- **Enterprise Security**: Argon2id password hashing, RFC 6238 TOTP Multi-Factor Authentication (MFA), 15-minute JWT access tokens with rotating refresh tokens, and rate limiting.

---

## Architecture Stack

| Layer | Component | Version / Provider |
|:---|:---|:---|
| **Framework** | NestJS | `v10.0` (Modular, Fastify/Express compatible) |
| **Runtime** | Node.js | `v20 LTS` |
| **Primary Database** | PostgreSQL | `v15` via Prisma ORM `v5` |
| **Queue & Cache** | Redis | `v7` via BullMQ `v5` |
| **Blockchain Client** | Stellar SDK | `v11` (Soroban RPC + Horizon client) |
| **API Spec** | OpenAPI / Swagger | Interactive docs exposed at `/docs` |

---

## Quickstart (< 5 minutes)

### Prerequisites
- Node.js 20 LTS (`.nvmrc` pinned)
- Docker & Docker Compose

```bash
# 1. Environment configuration
cp .env.example .env

# 2. Spin up local PostgreSQL (5432) and Redis (6379)
docker compose up -d

# 3. Install dependencies
npm install

# 4. Run Prisma schema migrations
npx prisma migrate dev

# 5. Seed development demo accounts
npm run seed

# 6. Start development server with live reload
npm run start:dev
```

Once running, explore the interactive OpenAPI Swagger UI at **`http://localhost:3000/docs`**.

### Demo Credentials (Development Seed Only)
| Role | Email | Password |
|:---|:---|:---|
| **Admin** | `admin@stellarrail.local` | `*Pass12345!` |
| **Operator** | `operator@stellarrail.local` | `*Pass12345!` |
| **Approver** | `approver@stellarrail.local` | `*Pass12345!` |

---

## Configuration Reference

Validated strictly on application bootstrap via Zod in `src/config/configuration.ts`:

| Variable | Description | Default / Example |
|:---|:---|:---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://stellar:stellar@localhost:5432/stellarrail?schema=public` |
| `REDIS_URL` | Redis instance URL for queues & caching | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Secret key for access token signing ($\ge 32$ chars) | *Generated securely in production* |
| `JWT_REFRESH_SECRET` | Secret key for rotating refresh tokens ($\ge 32$ chars) | *Generated securely in production* |
| `HORIZON_URL` | Stellar Horizon node endpoint | `https://horizon-testnet.stellar.org` |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `ESCROW_CONTRACT_ID` | Soroban Escrow Contract Address (SAC) | `CDAV32AHVV6Q7FFNPUFA76AARTGWBE2QFIU3WAPDV64QIBRTGUFKLU2K` |
| `KMS_PROVIDER` | Transaction signing provider (`local`, `aws`, `vault`) | `local` |
| `CHAIN_DRY_RUN` | Simulates on-chain submission without spending testnet XLM | `true` (default safe in development/CI) |

---

## API Surface Catalog (`/api/v1`)

```
├── Health & Telemetry
│   ├── GET  /health               System status, uptime, and component readiness
│   ├── GET  /health/chain         Horizon and Soroban RPC connectivity
│   └── GET  /metrics              Prometheus-compatible performance telemetry
├── Authentication & Identity
│   ├── POST /auth/login           Authenticate via email/password (returns JWT + MFA status)
│   ├── POST /auth/mfa/enroll      Generate TOTP QR code & seed secret
│   ├── POST /auth/mfa/verify      Confirm TOTP verification code
│   ├── POST /auth/refresh         Exchange rotating refresh token for fresh JWT
│   └── POST /auth/logout          Revoke session token and refresh token family
├── User Management
│   ├── GET  /users/me             Current user profile, role, and MFA state
│   ├── GET  /users                List organization users (Admin only)
│   └── DELETE /users/me           GDPR right-to-erasure account anonymization
├── Payments & Settlement
│   ├── POST /payments             Initiate payment request (Requires Idempotency-Key)
│   ├── GET  /payments             Paged list with status, destination, and role filters
│   ├── GET  /payments/stats       Total locked XLM, lifetime settled volume, failure rates
│   ├── GET  /payments/:id         Detailed escrow request breakdown and Soroban hashes
│   ├── POST /payments/:id/approve Approve payment execution (Approver role only)
│   ├── POST /payments/:id/reject  Reject pending payment (Approver role only)
│   └── POST /payments/:id/refund  Trigger escrow contract refund to depositor
└── Governance & Admin
    ├── POST /admin/reconcile      Trigger manual ledger-to-database reconciliation run
    ├── GET  /admin/reconciliation Audit discrepancies and unconfirmed on-chain transactions
    └── GET  /admin/queues         Inspect BullMQ job statuses and worker telemetry
```

---

## CLI & Tooling Scripts

| Script | Action |
|:---|:---|
| `npm run start:dev` | Start NestJS in watch mode with SWC compiler |
| `npm run build` | Compile production bundle into `dist/` |
| `npm test` | Run Jest unit tests (`test/jest-unit.json`) |
| `npm run test:e2e` | Execute end-to-end integration tests |
| `npm run typecheck` | Strict TypeScript compiler validation (`tsc --noEmit`) |
| `npm run lint` | ESLint static code analysis |
| `npm run format` | Prettier code formatting check and fix |
| `npm run openapi:export` | Dump canonical schema to `openapi.json` |
| `npm run chain:smoke` | Run live Soroban RPC contract smoke check |

---

## Operational Runbooks & Documentation

- [**API Specification**](docs/API.md): Detailed parameter schemas, request bodies, and error response codes.
- [**Production Runbook**](docs/RUNBOOK.md): Operations guide, alerts handling, and escalation playbooks.
- [**Chain Integration**](docs/CHAIN.md): Soroban transaction building, envelope decoding, and XDR handling.
- [**Secrets & KMS**](docs/SECRETS.md): Key rotation guidelines and HSM vault provisioning.
- [**Disaster Recovery**](docs/DISASTER_RECOVERY.md): Backup policies, database failover, and queue recovery.
- [**GDPR & Compliance**](docs/GDPR.md): Cryptographic erasure procedures and PII handling.

---

<p align="center">
  <sub>StellarRail Payment Orchestration Engine · Licensed under Apache-2.0</sub>
</p>
