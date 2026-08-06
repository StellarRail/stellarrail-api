# BUILD PLAN: stellarrail-api — 70 Issues to Production Ready

> **Repo:** `stellarrail-api` (NestJS, Node 20 LTS, TypeScript, PostgreSQL 15+, Redis + BullMQ, stellar-sdk + soroban-client)
> **Source of truth:** `../PRD.md` + `../Architecture.md`
> **Goal:** Production-ready payment orchestration API: auth/RBAC, payment state machine, KMS signing, Soroban/Horizon sync, workers, audit, reconciliation.

---

## AGENT EXECUTION PROMPT (MUST FOLLOW)

You are the builder agent for `stellarrail-api`. Execute issues **strictly sequentially from ISSUE-001 to ISSUE-070**.

Rules:
1. **One issue at a time.** Fully implement ISSUE-00X before starting the next.
2. **Verify each issue** with listed commands (lint, typecheck, jest, e2e, or docker as given). Fix failures before committing.
3. **Commit after EACH issue:**
   ```bash
   git add -A
   git commit -m "<type>(api): <short description> [ISSUE-0XX]"
   ```
   Use exact commit message per issue. `git init` once at ISSUE-001 if needed.
4. **Do not proceed** with dirty tree or failing checks.
5. **Production bar:** NestJS modular, Prisma/TypeORM parameterized, Zod validation on all inputs, idempotency everywhere, structured logs (no secrets), OpenAPI docs, ≥70% unit coverage on domain, <200ms p95 for CRUD.
6. At ISSUE-068–070 set up **GitHub Actions workflows**. After ISSUE-070 CI must be green on push/PR.
7. If issue already satisfied, verify + commit missing piece (or `--allow-empty` verified commit).

Types: `feat`, `fix`, `chore`, `test`, `docs`, `ci`, `security`, `perf`, `refactor`.

Start at ISSUE-001.

---

## PHASE A — SCAFFOLD & PLATFORM (001–010)

### ISSUE-001: Initialize NestJS + TypeScript strict + monorepo layout
**Goal:** Bootable API skeleton.
**Tasks:**
- `npm init / nest new .` (or `npx @nestjs/cli new`), TS `strict:true`, src modules: `auth`, `users`, `payments`, `chain`, `workers`, `audit`, `config`, `health`, `common`.
- `.nvmrc` node 20, `.editorconfig`, `README.md` stub.
- Scripts: `start:dev`, `build`, `lint`, `test`, `test:e2e`.
**Acceptance:** `npm run build && npm run start` serves, `GET /health` 200.
**Verify:** `npm run build && npm run test`
**Commit:** `chore(api): init nestjs modules [ISSUE-001]`

### ISSUE-002: Config + env validation (Zod) + fail-fast
**Goal:** 12-factor config per Arch §6.
**Tasks:**
- `src/config/configuration.ts` with Zod: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `STELLAR_NETWORK`, `HORIZON_URL`, `SOROBAN_RPC_URL`, `ESCROW_CONTRACT_ID`, `KMS_PROVIDER` (aws|vault|local), `PORT`.
- `.env.example`, `.env.test.example`. Throw on invalid at boot with readable message.
**Acceptance:** Missing secret prevents boot with clear error.
**Verify:** `npm run build`
**Commit:** `feat(api): env validation zod [ISSUE-002]`

### ISSUE-003: Lint/format/husky + commitlint
**Goal:** Quality gates.
**Tasks:**
- ESLint (airbnb-base-ish + @nestjs), Prettier, Husky pre-commit (lint-staged), commitlint conventional.
- Scripts `lint`, `format`, `typecheck`.
**Acceptance:** `npm run lint` clean.
**Verify:** `npm run lint && npx tsc --noEmit`
**Commit:** `chore(api): lint husky commitlint [ISSUE-003]`

### ISSUE-004: PostgreSQL + ORM (Prisma) + migrations
**Goal:** Primary store Arch §2.2.
**Tasks:**
- Install Prisma, `prisma/schema.prisma`: models `User`, `PaymentRequest`, `AuditLog`, `IdempotencyKey`, `ReconciliationRun` (fields per later issues).
- `docker-compose.yml` (postgres:15, redis:7), `prisma/migrations` init, seed script.
- Health check `GET /health/db`.
**Acceptance:** `docker compose up -d && npx prisma migrate dev` green, seed inserts demo users.
**Verify:** `npx prisma validate && npm run test -- prisma`
**Commit:** `feat(api): postgres prisma migrations [ISSUE-004]`

### ISSUE-005: Redis + BullMQ connection + base queue
**Goal:** Cache/queue Arch §2.2.
**Tasks:**
- `ioredis` + `@nestjs/bullmq`, `QueueModule` with `payments`, `reconciliation`, `notifications` queues, Redis health `GET /health/redis`.
- Graceful shutdown (close Redis on SIGTERM).
**Acceptance:** Enqueue/dequeue smoke test passes with local redis.
**Verify:** `npm run test -- queue`
**Commit:** `feat(api): redis bullmq base [ISSUE-005]`

### ISSUE-006: Structured logging + correlation IDs + redaction
**Goal:** Observability + no secret leaks.
**Tasks:**
- Pino/`nestjs-pino`, JSON in prod / pretty dev, `x-request-id` middleware (generate if absent, propagate), redact `password`, `secret`, `privateKey`, `Authorization`.
- Log every request (method, path, status, ms).
**Acceptance:** Log line contains requestId; secret never logged (test).
**Verify:** `npm run test -- logging`
**Commit:** `feat(api): structured logging redaction [ISSUE-006]`

### ISSUE-007: Global validation + exception filter + interceptors
**Goal:** Consistent API contract.
**Tasks:**
- Global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform), Zod-backed DTOs, `HttpExceptionFilter` → `{statusCode, code, message, requestId}`, response envelope + `durationMs` header, timeout interceptor 10s.
**Acceptance:** Unknown field → 400 with code `VALIDATION_ERROR`.
**Verify:** `npm run test:e2e -- validation`
**Commit:** `feat(api): validation exception filters [ISSUE-007]`

### ISSUE-008: Rate limiting + Helmet + CORS
**Goal:** Arch §5.3 / NFR Security.
**Tasks:**
- `@nestjs/throttler` (per-IP 100/min + per-user 60/min + strict 5/min on `/auth/login`), Helmet headers, CORS allowlist from env.
- 429 returns `Retry-After`.
**Acceptance:** 6th rapid login → 429 with header.
**Verify:** `npm run test:e2e -- throttler`
**Commit:** `security(api): rate-limit helmet cors [ISSUE-008]`

### ISSUE-009: OpenAPI/Swagger + versioning (`/api/v1`)
**Goal:** Contract-first.
**Tasks:**
- `@nestjs/swagger` at `/docs`, bearer auth, versioned prefix `api/v1`, tags per module. Export `openapi.json` artifact.
**Acceptance:** `/docs` renders, `/api/v1/health` versioned.
**Verify:** `npm run build && curl localhost:3000/docs`
**Commit:** `docs(api): swagger versioning [ISSUE-009]`

### ISSUE-010: Docker Compose dev +101 + seed users
**Goal:** One-command dev.
**Tasks:**
- `docker-compose.yml` full (api, postgres, redis), `Dockerfile.dev`, `npm run dev:up`, seed: admin/operator/approver (documented creds, MFA secret for test).
- README quickstart (<5 min).
**Acceptance:** Fresh clone → `docker compose up` → API + docs reachable.
**Verify:** `docker compose config`
**Commit:** `chore(api): compose dev seeds [ISSUE-010]`

---

## PHASE B — AUTH & RBAC (011–020)

### ISSUE-011: User model + password hashing (bcrypt/argon2)
**Goal:** FR-1.1 foundation.
**Tasks:**
- `User {id, email unique, passwordHash, role: ADMIN|OPERATOR|APPROVER, mfaSecret?, mfaEnabled, isActive, createdAt}`. Hash with bcrypt cost 12 (or argon2id). Never return hash.
**Acceptance:** Password stored hashed; `GET /users/me` omits hash.
**Verify:** `npm run test -- users`
**Commit:** `feat(api): user model hashing [ISSUE-011]`

### ISSUE-012: Register/invite + login (email/password)
**Goal:** FR-1.1.
**Tasks:**
- `POST /api/v1/auth/login {email,password}` → 401 generic on fail (no enumeration), lockout after 5 fails 15min; `POST /auth/invite` (admin only, sends token — log in dev).
- Zod DTOs, timing-safe compare.
**Acceptance:** Wrong password = generic 401 `INVALID_CREDENTIALS`.
**Verify:** `npm run test:e2e -- auth-login`
**Commit:** `feat(api): login invite [ISSUE-012]`

### ISSUE-013: MFA TOTP (enroll, verify, backup codes)
**Goal:** FR-1.1 MFA.
**Tasks:**
- `otplib`: `POST /auth/mfa/enroll` → otpauth URL + QR data; `POST /auth/mfa/verify {token}` enables; login flow returns `mfaRequired:true + mfaTicket` when enabled; 3-strike lockout; 8 backup codes (hashed).
**Acceptance:** Full enroll→login-with-MFA e2e passes.
**Verify:** `npm run test:e2e -- mfa`
**Commit:** `feat(api): mfa totp backup codes [ISSUE-013]`

### ISSUE-014: JWT access (15m) + refresh rotation (7d, reuse detection)
**Goal:** FR-1.2.
**Tasks:**
- Access JWT (sub, role, jti), refresh opaque stored hashed in Redis + DB with rotation; reuse of old refresh → revoke family + alert audit `REFRESH_REUSE`.
- `POST /auth/refresh`, `POST /auth/logout` (revoke).
**Acceptance:** Reused refresh → 401 + family revoked.
**Verify:** `npm run test:e2e -- refresh`
**Commit:** `feat(api): jwt rotation reuse-detect [ISSUE-014]`

### ISSUE-015: RBAC guards (Admin/Operator/Approver) at gateway level
**Goal:** FR-1.3.
**Tasks:**
- `@Roles()` + `RolesGuard`, `JwtAuthGuard`, resource guard `IsOwnerOrAdmin`. Apply globally; e2e matrix: each role × each endpoint → 200/403.
**Acceptance:** Operator `POST /users` → 403 `FORBIDDEN`.
**Verify:** `npm run test:e2e -- rbac`
**Commit:** `feat(api): rbac guards [ISSUE-015]`

### ISSUE-016: Sessions in Redis + logout everywhere + me endpoint
**Goal:** Session control.
**Tasks:**
- `GET /users/me`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/logout-all`. Admin can revoke any.
**Acceptance:** Logout-all invalidates all refresh tokens.
**Verify:** `npm run test:e2e -- sessions`
**Commit:** `feat(api): sessions management [ISSUE-016]`

### ISSUE-017: Password reset + change + policy
**Goal:** Account safety.
**Tasks:**
- `POST /auth/forgot` (always 200, token via log in dev, 1h TTL), `POST /auth/reset`, `POST /users/me/password` (require current). Policy: ≥12 chars, breach-list check (common 10k deny).
**Acceptance:** Weak `password123` rejected with code.
**Verify:** `npm run test -- password-policy`
**Commit:** `feat(api): password reset policy [ISSUE-017]`

### ISSUE-018: Admin user CRUD + deactivate + MFA reset
**Goal:** Admin persona PRD §3.
**Tasks:**
- `GET/POST /users`, `PATCH /users/:id {role,isActive}`, `POST /users/:id/reset-mfa`, pagination. Deactivate revokes sessions.
**Acceptance:** Deactivated user login → 403 `ACCOUNT_DISABLED`.
**Verify:** `npm run test:e2e -- admin-users`
**Commit:** `feat(api): admin user crud [ISSUE-018]`

### ISSUE-019: Audit every auth event
**Goal:** FR-6.1 (login, mfa, refresh, logout).
**Tasks:**
- Emit audit via `AuditService` (actor, action, IP, userAgent, result). Covered actions: `LOGIN_SUCCESS/FAIL`, `MFA_*`, `LOGOUT`, `ROLE_CHANGE`.
**Acceptance:** Failed login creates audit row.
**Verify:** `npm run test -- audit-auth`
**Commit:** `feat(api): audit auth events [ISSUE-019]`

### ISSUE-020: Auth hardening tests (enumeration, timing, lockout, 429)
**Goal:** Lock auth.
**Tasks:**
- Tests: no email enumeration (same response time ±tolerance + same code), lockout, throttler, JWT expiry, refresh reuse.
**Acceptance:** All green.
**Verify:** `npm run test:e2e -- auth-hardening`
**Commit:** `test(api): auth hardening [ISSUE-020]`

---

## PHASE C — PAYMENTS STATE MACHINE (021–035)

### ISSUE-021: PaymentRequest model + statuses + migration
**Goal:** FR-2 lifecycle store.
**Tasks:**
- Model: `{id uuid, referenceId unique, requesterId, destination, amountStroops bigint, memo?, status: DRAFT|CREATED|LOCKED_IN_ESCROW|PENDING_APPROVAL|SETTLING|SETTLED|REFUNDING|REFUNDED|FAILED|EXPIRED|TIMEOUT, escrowTxHash?, releaseTxHash?, refundTxHash?, deadline, idempotencyKey unique, createdAt, updatedAt}`. Index `(status, createdAt)`, `(requesterId)`.
**Acceptance:** Migration applies cleanly forward/back.
**Verify:** `npx prisma migrate dev && npm run test -- payment-model`
**Commit:** `feat(api): payment model statuses [ISSUE-021]`

### ISSUE-022: Create payment (Operator/Admin) + Zod validation
**Goal:** FR-2.1 → DRAFT/CREATED.
**Tasks:**
- `POST /api/v1/payments {destination, amountXlm, memo?, referenceId?, idempotencyKey?}`: StrKey validate, amount → stroops integer (reject >7 decimals), memo ≤28 chars, referenceId `^[A-Za-z0-9-_]{4,64}`.
- Returns 201 with status `CREATED`.
**Acceptance:** `0.00000001` XLM → 400 `INVALID_PRECISION`.
**Verify:** `npm run test:e2e -- payments-create`
**Commit:** `feat(api): create payment validation [ISSUE-022]`

### ISSUE-023: Blocklist + spending limits pre-checks
**Goal:** FR-2.2 + Admin limits.
**Tasks:**
- `BlocklistService` (env list + DB table `BlockedAddress`, cached 5m): blocked → 422 `ADDRESS_BLOCKED`.
- `LimitsService`: per-tx + daily-role limits from `SystemConfig`; exceed → 422 `LIMIT_EXCEEDED` with limit detail (still creates? No — reject per v1 strict).
**Acceptance:** Blocked address e2e → 422 + audit entry.
**Verify:** `npm run test:e2e -- blocklist-limits`
**Commit:** `feat(api): blocklist limits checks [ISSUE-023]`

### ISSUE-024: Idempotency keys (header + body, 24h window)
**Goal:** Arch §Key Principles idempotency.
**Tasks:**
- Accept `Idempotency-Key` header or body key; store request hash + response snapshot; same key+same payload → replay stored 201; same key+different payload → 409 `IDEMPOTENCY_CONFLICT`.
- `IdempotencyKey` table with TTL cleanup job.
**Acceptance:** Double POST same key = 1 DB row.
**Verify:** `npm run test:e2e -- idempotency`
**Commit:** `feat(api): idempotency keys [ISSUE-024]`

### ISSUE-025: State machine service (guarded transitions)
**Goal:** FR-2.4 correctness.
**Tasks:**
- `PaymentStateMachine`: allowed map (`CREATED→LOCKED_IN_ESCROW`, `LOCKED_IN_ESCROW→PENDING_APPROVAL`, `PENDING→SETTLING→SETTLED`, `PENDING→REFUNDING→REFUNDED`, `*→FAILED/TIMEOUT/EXPIRED` where valid). Illegal → 409 `INVALID_TRANSITION`. Row-level lock (`SELECT FOR UPDATE`) / optimistic `version` column.
- Unit matrix test all transitions.
**Acceptance:** `SETTLED→PENDING` rejected.
**Verify:** `npm run test -- state-machine`
**Commit:** `feat(api): payment state machine [ISSUE-025]`

### ISSUE-026: List/get payments (filter, pagination, role scoping)
**Goal:** Dashboards backing.
**Tasks:**
- `GET /payments?status=&search=&page=&limit=&sort=` (cursor or offset, max 100), Operator sees own, Approver sees pending+history, Admin all. `GET /payments/:id`, `GET /payments/stats` (counts, volume).
- p95 <200ms on 10k seed (add indexes, `EXPLAIN` check).
**Acceptance:** Operator cannot fetch another's DRAFT (404 masked, not 403 leak).
**Verify:** `npm run test:e2e -- payments-list`
**Commit:** `feat(api): list get payments scoping [ISSUE-026]`

### ISSUE-027: Update/cancel DRAFT (edit + delete)
**Goal:** Draft ergonomics.
**Tasks:**
- `PATCH /payments/:id` (only DRAFT, re-validate), `DELETE /payments/:id` (only DRAFT, soft-delete or hard with audit). Non-DRAFT → 409.
**Acceptance:** PATCH SETTLED → 409.
**Verify:** `npm run test:e2e -- draft-edit`
**Commit:** `feat(api): draft edit cancel [ISSUE-027]`

### ISSUE-028: Approve endpoint (Approver/Admin, SoD enforced)
**Goal:** FR-3.2/3.3/3.5.
**Tasks:**
- `POST /payments/:id/approve {idempotencyKey?}`: require APPROVER|ADMIN, reject if `requesterId===actorId` → 403 `SOD_VIOLATION` (unless admin override flag + reason? v1: hard deny, log attempt), require `PENDING_APPROVAL`, transition → `SETTLING`, enqueue `release` job.
**Acceptance:** Self-approve → 403 + audit `SOD_BLOCKED`.
**Verify:** `npm run test:e2e -- approve`
**Commit:** `feat(api): approve sod [ISSUE-028]`

### ISSUE-029: Reject endpoint (reason required → REFUNDING)
**Goal:** FR-3.4.
**Tasks:**
- `POST /payments/:id/reject {reason enum + note?}` (reason required, note ≥10 chars for OTHER), SoD same as approve, transition → `REFUNDING`, enqueue `refund` job.
**Acceptance:** Missing reason → 400.
**Verify:** `npm run test:e2e -- reject`
**Commit:** `feat(api): reject reason [ISSUE-029]`

### ISSUE-030: Deadline/expiry scheduler (mark EXPIRED, enqueue refund)
**Goal:** FR-4.4 support.
**Tasks:**
- `deadline` default +24h on create (configurable). `@Cron('*/5 * * * *')` finds `PENDING_APPROVAL` past deadline → `EXPIRED` + enqueue refund if escrow-locked. Config flag `AUTO_REFUND_ON_EXPIRY=true`.
**Acceptance:** Expired fixture flips on cron tick in test (fake timers).
**Verify:** `npm run test -- expiry`
**Commit:** `feat(api): expiry scheduler [ISSUE-030]`

### ISSUE-031: SystemConfig (limits, deadlines, network) CRUD
**Goal:** Admin configurability.
**Tasks:**
- `GET/PUT /config {perTxLimitXlm, dailyLimitPerRole, approvalThreshold, defaultDeadlineHours, maintenanceReadOnly}` — admin only, Zod, cached in Redis 60s, audit logged.
**Acceptance:** Limit change affects next create (e2e).
**Verify:** `npm run test:e2e -- config`
**Commit:** `feat(api): system config [ISSUE-031]`

### ISSUE-032: Notifications service (email/log/webhook stubs)
**Goal:** Approver ping + status pushes.
**Tasks:**
- `NotificationsService` interface + `LogProvider` (dev) + `SmtpProvider` skeleton; events: `PAYMENT_PENDING`, `PAYMENT_SETTLED`, `PAYMENT_REFUNDED`, `RECON_MISMATCH`. Queue via BullMQ `notifications`.
- `GET /notifications`, `POST /notifications/:id/read`.
**Acceptance:** Approve triggers queued notification (assert in test).
**Verify:** `npm run test -- notifications`
**Commit:** `feat(api): notifications service [ISSUE-032]`

### ISSUE-033: Payment audit trail (every transition logged)
**Goal:** FR-6 + KPI 100% audit completeness.
**Tasks:**
- On every mutation write `AuditLog {actorId, action, entityId, payloadHash (sha256 of canonical payload), ip}`. Add `GET /payments/:id/timeline` merging payment events + audit.
- Test: create→approve produces ≥3 audit rows.
**Acceptance:** Timeline endpoint returns ordered events.
**Verify:** `npm run test:e2e -- timeline`
**Commit:** `feat(api): payment audit timeline [ISSUE-033]`

### ISSUE-034: Read-only / maintenance mode guard
**Goal:** PRD §7 RC1 read-only.
**Tasks:**
- If `config.maintenanceReadOnly`, block all mutating payment/auth-mutating endpoints with 503 `READ_ONLY_MODE` (except admin unblock). Middleware + e2e.
**Acceptance:** POST payments in readonly → 503.
**Verify:** `npm run test:e2e -- readonly`
**Commit:** `feat(api): readonly mode guard [ISSUE-034]`

### ISSUE-035: Payments module tests (e2e matrix, SoD, idempotency, limits)
**Goal:** Lock payments.
**Tasks:**
- Full e2e: operator create → approve → settled; reject → refunded; self-approve 403; idempotent double; limit/blocked; readonly.
**Acceptance:** Suite green, ≥70% payments coverage.
**Verify:** `npm run test:e2e -- payments && npm run test -- payments --coverage`
**Commit:** `test(api): payments matrix [ISSUE-035]`

---

## PHASE D — CHAIN SERVICE: KMS, SOROBAN, HORIZON (036–046)

### ISSUE-036: Signer abstraction (Local dev + AWS KMS + Vault stubs)
**Goal:** Arch §5.1 hybrid custody, NFR no raw keys in env.
**Tasks:**
- `SignerService` interface `signEnvelope(xdr: string): Promise<string>`; `LocalSigner` (env mnemonic ONLY in dev/test, warn in prod), `KmsSigner` (AWS SDK `Sign` — stubbed, throws `NOT_CONFIGURED` without creds), `VaultSigner` stub. Factory by `KMS_PROVIDER`. Never log keys.
- Test with local signer.
**Acceptance:** Prod boot with `local` provider → fatal warn + refuse unless `ALLOW_LOCAL_SIGNER=true`.
**Verify:** `npm run test -- signer`
**Commit:** `feat(api): signer abstraction kms [ISSUE-036]`

### ISSUE-037: Stellar client (Horizon + Soroban RPC wrappers, retry)
**Goal:** Chain I/O resilience.
**Tasks:**
- `StellarService`: Horizon client (axios, 5s timeout, retry 3 backoff), Soroban RPC `sendTransaction/getTransaction/events`, network passphrase by env, parse errors → typed `ChainError {code: RPC_DOWN|TX_FAILED|TIMEOUT}`.
- Metrics: rpc latency histogram.
**Acceptance:** RPC 500 mocked → 3 retries then `RPC_DOWN`.
**Verify:** `npm run test -- stellar-client`
**Commit:** `feat(api): stellar horizon rpc client [ISSUE-037]`

### ISSUE-038: Deposit orchestration (CREATED → LOCKED_IN_ESCROW → PENDING_APPROVAL)
**Goal:** FR-2.3 + Arch Step 2.
**Tasks:**
- On create, enqueue `deposit` job: build `escrow.deposit()` invocation (amount stroops, requestId), sign via Signer, submit, poll `getTransaction` until SUCCESS (60s), store `escrowTxHash`, transition to `LOCKED→PENDING`, notify approvers. Fail → `FAILED` + retry w/ backoff (max 5) then `TIMEOUT`.
- Dry-run mode `CHAIN_DRY_RUN=true` (for CI without testnet: fake hash `DRYRUN-*`).
**Acceptance:** Dry-run create reaches PENDING in <5s in test.
**Verify:** `npm run test:e2e -- deposit --dry-run`
**Commit:** `feat(api): deposit orchestration [ISSUE-038]`

### ISSUE-039: Release orchestration (SETTLING → SETTLED)
**Goal:** FR-3.3 + Arch Step 3.
**Tasks:**
- `release` job: build `escrow.release(request_id, destination)`, sign+submit, await success, store `releaseTxHash`, → `SETTLED`, notify requester. Idempotent (skip if already SETTLED, reuse hash). Failure → `SETTLING` stays + alert + manual-retry endpoint `POST /payments/:id/retry`.
**Acceptance:** Retry endpoint re-enqueues without double-spend (same release args).
**Verify:** `npm run test:e2e -- release`
**Commit:** `feat(api): release orchestration [ISSUE-039]`

### ISSUE-040: Refund orchestration (REFUNDING → REFUNDED, expiry path)
**Goal:** FR-3.4/4.4.
**Tasks:**
- Mirror release with `escrow.refund(request_id)` → `REFUNDED`. Expiry auto-path included. Manual `POST /payments/:id/refund` (admin only) for stuck funds.
**Acceptance:** Reject in dry-run → REFUNDED e2e.
**Verify:** `npm run test:e2e -- refund`
**Commit:** `feat(api): refund orchestration [ISSUE-040]`

### ISSUE-041: Horizon event indexer (poll → confirm/fail)
**Goal:** FR-5.1/5.2.
**Tasks:**
- Worker polls `getTransaction`/`getEvents` for tracked hashes every 30s (`chain-indexer` queue repeatable), maps: SUCCESS→`CONFIRMED` flag, ERROR→`FAILED`. Store `onChainStatus`, `ledger`, `confirmedAt`.
**Acceptance:** Mocked Horizon SUCCESS flips flag.
**Verify:** `npm run test -- indexer`
**Commit:** `feat(api): horizon indexer [ISSUE-041]`

### ISSUE-042: Reconciliation job (daily ledger vs DB, mismatch flags)
**Goal:** FR-5.3.
**Tasks:**
- `@Cron('0 2 * * *')` + manual `POST /admin/reconcile`: compare DB `SETTLED/REFUNDED` vs on-chain events for day window; write `ReconciliationRun {startedAt, finishedAt, checked, mismatches[], status}`; on mismatch: set `needsReview=true` + `RECON_MISMATCH` audit + notification. `GET /admin/reconciliation` lists runs.
**Acceptance:** Fixture with forged DB row detected as mismatch.
**Verify:** `npm run test -- reconcile`
**Commit:** `feat(api): reconciliation job [ISSUE-042]`

### ISSUE-043: Chain fault tolerance (queue when RPC down, backoff, DLQ)
**Goal:** NFR Availability graceful degradation.
**Tasks:**
- BullMQ: attempts 5, exponential backoff, DLQ `chain-dlq`, circuit-breaker (pause 60s after 10 consec fails), `GET /health/chain` (rpc reachable, queue depths, dlq size).
- Docs `docs/CHAIN_RUNBOOK.md` (RPC down procedure + CLI manual release/refund commands).
**Acceptance:** Kill mock RPC → jobs queue (not lost), health shows degraded.
**Verify:** `npm run test -- chain-resilience`
**Commit:** `feat(api): chain fault tolerance [ISSUE-043]`

### ISSUE-044: Stellar address utils + amount (stroops) library
**Goal:** Shared correctness.
**Tasks:**
- `src/common/stellar.ts`: `isValidAddress` (StrKey), `xlmToStroops` (exact decimal, no float), `formatXlm`, memo validation. Fuzz tests (bad inputs never throw unhandled).
**Acceptance:** `0.1+0.2` style float bug impossible (string-based math).
**Verify:** `npm run test -- stellar-utils`
**Commit:** `feat(api): stellar utils stroops [ISSUE-044]`

### ISSUE-045: Chaindry-run + testnet contract wiring + docs
**Goal:** Alpha testnet ready.
**Tasks:**
- Wire `ESCROW_CONTRACT_ID` per network, `scripts/chain-smoke.ts` (deposit→release→refund on testnet with tiny 1 XLM, dry-run default), `docs/CHAIN.md` (funding test accounts via Friendbot, contract IDs).
**Acceptance:** `CHAIN_DRY_RUN=true npm run chain:smoke` green without network.
**Verify:** `npm run chain:smoke`
**Commit:** `feat(api): chain smoke docs [ISSUE-045]`

### ISSUE-046: Chain tests (orchestration matrix with mocks)
**Goal:** Lock chain layer.
**Tasks:**
- Mock Signer + RPC: deposit/release/refund success, RPC down, tx failed, timeout, double-release idempotent. Coverage ≥70% on `chain/`.
**Acceptance:** Green.
**Verify:** `npm run test -- chain --coverage`
**Commit:** `test(api): chain matrix [ISSUE-046]`

---

## PHASE E — AUDIT, OBSERVABILITY, SECURITY (047–060)

### ISSUE-047: AuditLog model (append-only, hash-chained)
**Goal:** FR-6 immutable logs.
**Tasks:**
- Model `{id, timestamp, actorId?, action, entityType, entityId?, payloadHash, ip, userAgent, prevHash?, hash}` — hash chain (`hash = sha256(prevHash+canonical)`), DB trigger/rule blocks UPDATE/DELETE (or app-level + test asserting update fails). `GET /audit` (admin, filters, pagination).
**Acceptance:** Direct `UPDATE audit_log` rejected (test expects error).
**Verify:** `npm run test -- audit-immutable`
**Commit:** `feat(api): audit append-only chain [ISSUE-047]`

### ISSUE-048: Audit export (CSV/JSON, 10k cap, async for large)
**Goal:** FR-6.2.
**Tasks:**
- `GET /audit/export?format=csv|json&from=&to=` streams (cursor pagination), caps 10k sync else 202 + job + download link. Filename + `Content-Disposition`.
**Acceptance:** CSV header matches spec (timestamp,actor,action,hash,ip).
**Verify:** `npm run test:e2e -- audit-export`
**Commit:** `feat(api): audit export [ISSUE-048]`

### ISSUE-049: Audit partitioning + retention + GDPR delete
**Goal:** Arch scalability + NFR compliance.
**Tasks:**
- Monthly Postgres partitioning (or documented strategy + `audit_archive` job), `DELETE /users/me` (GDPR: anonymize PII, retain hashes per SOC2 note), `docs/GDPR.md`.
**Acceptance:** Delete-user keeps audit hashes, scrubs email.
**Verify:** `npm run test -- gdpr`
**Commit:** `feat(api): audit retention gdpr [ISSUE-049]`

### ISSUE-050: Prometheus metrics + health aggregate
**Goal:** Arch Monitor.
**Tasks:**
- `prom-client`: http duration/count, payments by status, chain latency, queue depth, recon mismatches; `GET /metrics` (restricted), `GET /health` aggregate `{api,db,redis,chain}` with 200/503.
**Acceptance:** `/metrics` exposes `http_request_duration_seconds`.
**Verify:** `curl localhost:3000/metrics`
**Commit:** `feat(api): metrics health [ISSUE-050]`

### ISSUE-051: Sentry + error taxonomy + alert hooks
**Goal:** Pilot monitoring.
**Tasks:**
- Sentry init (prod only, sample 10%), typed error codes (`SOD_VIOLATION`, `RPC_DOWN`, ...), PagerDuty/Slack webhook stub on `RECON_MISMATCH`/`REFRESH_REUSE`/5xx spike. No PII in Sentry (test).
**Acceptance:** Docs `docs/ALERTING.md` with run links.
**Verify:** `npm run build`
**Commit:** `feat(api): sentry alerting [ISSUE-051]`

### ISSUE-052: Input hardening (Zod everywhere, SQLi/XSS guards)
**Goal:** Arch §5.3.
**Tasks:**
- Audit all DTOs use Zod strict; ORM only (no raw SQL or parameterized + review); memo escaped in logs; tests with SQLi `'; DROP--` + XSS `<script>` payloads assert 400/escaped.
**Acceptance:** Payloads stored escaped, never executed.
**Verify:** `npm run test -- hardening`
**Commit:** `security(api): input hardening [ISSUE-052]`

### ISSUE-053: Secrets hygiene (no raw keys, startup scan)
**Goal:** NFR Security.
**Tasks:**
- Startup check fails if `PRIVATE_KEY`/`MNEMONIC` in env in prod; docs `docs/SECRETS.md` (KMS/Vault wiring); `gitleaks` config + CI hook; dependabot enabled.
**Acceptance:** `PRIVATE_KEY=abc npm run start:prod` refuses to boot.
**Verify:** manual + `gitleaks detect`
**Commit:** `security(api): secrets hygiene [ISSUE-053]`

### ISSUE-054: Performance (indexes, N+1, p95 <200ms)
**Goal:** NFR Performance.
**Tasks:**
- Add missing indexes (audit timestamp, payments status), DataLoader/select-optimization, `k6` smoke `scripts/load.js` (100 VUs CRUD), document p95 in `docs/PERF.md`.
**Acceptance:** k6 CRUD p95 <200ms locally (or documented bottleneck).
**Verify:** `k6 run scripts/load.js || npm run test -- perf`
**Commit:** `perf(api): indexes load test [ISSUE-054]`

### ISSUE-055: Pagination/cursor + ETag + caching headers
**Goal:** Scale reads.
**Tasks:**
- Cursor pagination on hot endpoints, `ETag` on config/stats, Redis cache 30s for stats/health with invalidation.
**Acceptance:** Second stats call hits cache (header `X-Cache: HIT`).
**Verify:** `npm run test:e2e -- caching`
**Commit:** `perf(api): caching etag [ISSUE-055]`

### ISSUE-056: Background worker scaling (concurrency, graceful, BullBoard)
**Goal:** Arch horizontal scaling.
**Tasks:**
- Concurrency per queue via env, graceful shutdown drain, BullBoard at `/admin/queues` (admin only, prod disabled by flag).
**Acceptance:** SIGTERM drains without losing active job (test).
**Verify:** manual
**Commit:** `feat(api): worker scaling board [ISSUE-056]`

### ISSUE-057: API docs + Postman/Bruno collection + examples
**Goal:** Adoptability KPI.
**Tasks:**
- `docs/API.md` (auth flow, idempotency, SoD, error codes table), export `openapi.json` + Bruno collection `docs/bruno/`, example `.http` file.
**Acceptance:** New dev can login→create→approve via collection unaided.
**Verify:** manual run collection once
**Commit:** `docs(api): collection examples [ISSUE-057]`

### ISSUE-058: Unit coverage ≥70% (domain: auth, payments, chain, audit)
**Goal:** Regression safety.
**Tasks:**
- Fill gaps, enforce `jest --coverage --coverageThreshold='{"global":{"statements":70}}'` in CI.
**Acceptance:** Gate passes.
**Verify:** `npm run test --coverage`
**Commit:** `test(api): coverage 70 gate [ISSUE-058]`

### ISSUE-059: E2E suite (Supertest: full lifecycle on postgres+redis)
**Goal:** Release gate.
**Tasks:**
- `test/e2e/*.e2e-spec.ts`: auth→payments→approve→recon→audit; `docker-compose -f docker-compose.test.yml` isolated; `npm run test:e2e:ci`.
**Acceptance:** Green in CI with real postgres/redis services.
**Verify:** `npm run test:e2e:ci`
**Commit:** `test(api): e2e suite [ISSUE-059]`

### ISSUE-060: Security review (OWASP top-10 checklist + pen-test notes)
**Goal:** Pre-prod gate.
**Tasks:**
- `docs/SECURITY_REVIEW.md`: tick auth, injection, XSS, SSRF (Horizon URL allowlist), JWT, rate-limit, secrets, headers; `npm audit` clean (or triaged).
**Acceptance:** All items ticked or risk-accepted with owner.
**Verify:** `npm audit --audit-level=high`
**Commit:** `security(api): owasp review [ISSUE-060]`

---

## PHASE F — DEPLOY HARDENING (061–067)

### ISSUE-061: Production Dockerfile (multi-stage, non-root, slim)
**Goal:** Deployable image.
**Tasks:**
- `Dockerfile` (node:20-alpine build → runner, `node` non-root, dumb-init, `HEALTHCHECK CMD wget /health`), `.dockerignore`. `npm run docker:build && docker run` smoke.
**Acceptance:** Image <300MB, runs as non-root (`whoami` test in docs).
**Verify:** `docker build -t stellarrail-api:local .`
**Commit:** `chore(api): prod dockerfile [ISSUE-061]`

### ISSUE-062: Migrations in release phase + seed-prod guard
**Goal:** Safe deploys.
**Tasks:**
- `npm run db:migrate:deploy` as release command (ECS `command` / K8s init), seed only when `SEED_DEMO=true` (never prod default), backward-compatible migration policy doc.
**Acceptance:** Docs `docs/DEPLOY.md` migration section.
**Verify:** `npx prisma migrate diff` dry-run
**Commit:** `chore(api): migrate release phase [ISSUE-062]`

### ISSUE-063: Graceful shutdown + liveness/readiness probes
**Goal:** 99.9% uptime.
**Tasks:**
- Handle SIGTERM (drain HTTP + workers + Prisma), K8s/ECS probes: `/health/live`, `/health/ready` (db+redis+chain reachable).
**Acceptance:** Rolling restart loses 0 in-flight (log evidence).
**Verify:** manual
**Commit:** `feat(api): graceful probes [ISSUE-063]`

### ISSUE-064: Backups/PITR docs + restore drill
**Goal:** Arch §7 RPO<1h RTO<4h.
**Tasks:**
- `docs/DISASTER_RECOVERY.md`: RDS snapshots + PITR steps, Redis persistence note, KMS region-replicate note, manual escrow CLI fallback (funds safe on-chain), RPO/RTO table.
**Acceptance:** Restore steps runnable (reviewed, not necessarily executed on prod).
**Verify:** doc review
**Commit:** `docs(api): disaster recovery [ISSUE-064]`

### ISSUE-065: staging vs prod config (testnet vs mainnet guardrails)
**Goal:** Arch §6 env strategy.
**Tasks:**
- `src/config/networks.ts` (dev/testnet, staging/testnet-anonymized, prod/mainnet), prod guard: require `CONFIRM_MAINNET=I_UNDERSTAND_REAL_FUNDS` to boot on mainnet; banner in `/health` + logs.
**Acceptance:** Prod boot without confirm → fatal.
**Verify:** `npm run test -- mainnet-guard`
**Commit:** `feat(api): mainnet guardrails [ISSUE-065]`

### ISSUE-066: Runbooks (chain down, queue stuck, mismatch, key rotation)
**Goal:** Operability.
**Tasks:**
- `docs/RUNBOOK.md`: symptoms→diagnosis→commands for 6 incidents incl. quarterly key rotation steps.
**Acceptance:** Each runbook has copy-paste commands.
**Verify:** doc review
**Commit:** `docs(api): runbooks [ISSUE-066]`

### ISSUE-067: PRODUCTION checklist + CHANGELOG + LICENSE
**Goal:** Pre-release gate.
**Tasks:**
- `docs/PRODUCTION.md` (envs, secrets, migrations, mainnet confirm, Sentry, metrics, backups, load test evidence), `CHANGELOG.md` init, license headers check.
- Tag readiness: all prior green.
**Acceptance:** Checklist fully ticked.
**Verify:** manual review
**Commit:** `docs(api): production checklist [ISSUE-067]`

---

## PHASE G — CI/CD WORKFLOWS (068–070) ★ REQUIRED

### ISSUE-068: GitHub Actions — CI (lint, typecheck, unit, prisma, build)
**Goal:** Every push/PR gated.
**Tasks:**
- `.github/workflows/ci.yml`: Node 20, npm cache, services (postgres:15, redis:7); jobs: `lint`, `typecheck (tsc)`, `unit (jest --coverage)`, `e2e (supertest vs services, CHAIN_DRY_RUN=true)`, `build`, `prisma-validate`, upload coverage + openapi.json artifacts. Branch protection doc.
**Acceptance:** Workflow green on this commit.
**Verify:** `cat .github/workflows/ci.yml && npm run lint && npm run test`
**Commit:** `ci(api): github actions ci [ISSUE-068]`

### ISSUE-069: GitHub Actions — Docker build/push + migration check + security scan
**Goal:** Supply-chain + deploy artifact.
**Tasks:**
- `.github/workflows/docker.yml`: on `main` + tags `v*`: buildx → GHCR (`ghcr.io/<org>/stellarrail-api`), attest provenance, run `trivy`/`grype` scan (fail on CRITICAL), `prisma migrate diff --check` guard.
- `.github/workflows/codeql.yml` or `gitleaks.yml`: secret scan.
**Acceptance:** Image pullable, scan clean.
**Verify:** inspect YAML + `docker build` locally
**Commit:** `ci(api): docker scan workflows [ISSUE-069]`

### ISSUE-070: GitHub Actions — Release/staging deploy + tag RC1
**Goal:** Production-ready delivery.
**Tasks:**
- `.github/workflows/release.yml`: on `v*`: full CI+E2E, Docker publish, `prisma migrate deploy` dry-run check, create GitHub Release with changelog, require `docs/PRODUCTION.md` tick.
- `.github/workflows/deploy-staging.yml` (template for ECS/Fly/Render — pick one, document vars: DATABASE_URL, REDIS_URL, secrets via OIDC, no hardcoded creds).
- README badges (CI, Docker, coverage), final full green `lint+test+e2e+build`, tag `api-v1.0.0-rc1`.
**Acceptance:** All workflows valid (`gh workflow list` or actionlint), badges render, tag pushed.
**Verify:** `ls .github/workflows/ && npm run lint && npm run build`
**Commit:** `ci(api): release deploy rc1 [ISSUE-070]`

---

## DONE DEFINITION
- [ ] 70 commits minimum, sequential.
- [ ] `lint`, `typecheck`, `test --coverage`, `test:e2e:ci`, `build` green.
- [ ] `/docs` Swagger live, `openapi.json` exported.
- [ ] `.github/workflows/{ci,docker,codeql,release,deploy-staging}.yml` present + passing.
- [ ] `Dockerfile` builds, runs non-root, probes pass.
- [ ] `docs/{PRODUCTION,RUNBOOK,DISASTER_RECOVERY,SECRETS,CHAIN}.md` complete.
- [ ] Tag `api-v1.0.0-rc1` pushed.

*End of stellarrail-api build plan.*
