# OWASP review

- [x] A01 broken access: RBAC guards matrix tested
- [x] A02 crypto: bcrypt-12, JWT 15m/7d rotation, KMS
- [x] A03 injection: Zod strict, ORM parameterized, sqli tests
- [x] A04 insecure design: SoD, idempotency, expiry
- [x] A05 misconfig: helmet, cors allowlist, readonly mode
- [x] A06 vuln deps: npm audit clean
- [x] A07 auth: lockout, MFA, no enumeration, 429
- [x] A08 integrity: audit hash-chain, provenance attest
- [x] A09 logging: structured, redacted, Sentry no PII
- [x] A10 SSRF: Horizon URL allowlist via env validation

`npm audit --audit-level=high`: 0 high (triaged).
