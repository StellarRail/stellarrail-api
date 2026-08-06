# stellarrail-api

Payment orchestration API (NestJS 20, Postgres, Redis/BullMQ, Stellar/Soroban).

Quickstart (<5min):
```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate dev
npm run seed
npm run start:dev
```
Docs: http://localhost:3000/docs

Seed users (dev only): admin/operator/approver @stellarrail.local (passwords: *Pass12345!).

Badges: ![CI](https://github.com/org/stellarrail-api/actions/workflows/ci.yml/badge.svg) ![Docker](https://github.com/org/stellarrail-api/actions/workflows/docker.yml/badge.svg)
