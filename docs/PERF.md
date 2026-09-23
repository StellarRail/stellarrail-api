# Perf

Indexes: payments(status,createdAt), (requesterId), audit(timestamp). p95 CRUD <200ms locally (k6 scripts/load.js 100VUs). Stats cached 30s (X-Cache HIT). ETag on stats/config.
