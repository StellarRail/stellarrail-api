# Deploy

Release phase migrations: `npm run db:migrate:deploy` as ECS command/K8s initContainer. Seed only when SEED_DEMO=true (never prod default). Backward-compatible migrations only.
