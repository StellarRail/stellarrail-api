# API

Auth: POST /api/v1/auth/login -> accessToken (15m) + refreshToken (7d rotation). MFA: enroll/verify, mfaRequired ticket.

Idempotency: `Idempotency-Key` header or body key, 24h window, same key+different payload -> 409.

SoD: operator cannot approve own request -> 403 SOD_VIOLATION.

Error codes: VALIDATION_ERROR, INVALID_CREDENTIALS, FORBIDDEN, SOD_VIOLATION, IDEMPOTENCY_CONFLICT, ADDRESS_BLOCKED, LIMIT_EXCEEDED, INVALID_TRANSITION, RPC_DOWN, READ_ONLY_MODE, RATE_LIMITED.
