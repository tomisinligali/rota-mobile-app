---
trigger: always_on
---

# Security Rules

## Authentication

- Authentication is handled by the backend.
- Use Argon2id for password hashing.
- Sessions must be server-controlled and revocable.
- Session cookies/tokens must use secure configuration appropriate to the environment.
- Email verification secrets must expire and be single-use.
- Password reset secrets must expire and be single-use.
- Never use Math.random() or Node's crypto.randomInt() to generate verification codes. Use crypto.randomBytes() with secure byte mapping.

## Authorization

- Never trust client-provided roles or permissions.
- Enforce authorization on the backend.
- Team roles are scoped to the relevant team.
- Every protected query/mutation must enforce business/team ownership.

## Tenant Isolation

Every request involving business data must verify:

1. The authenticated user.
2. Their business membership.
3. Their team membership where applicable.
4. Their role/permission for the requested operation.

Never allow cross-business data access.

## Rate Limiting

Rate-limit sensitive operations, including:

- Login
- Signup
- Password reset
- Verification/resend
- Other abuse-sensitive endpoints

Use Redis where distributed rate limiting is required.

## Login Protection

Progressively throttle repeated failed login attempts.

Do not reveal whether a particular email account exists through authentication errors.

## Redis Locks

- Distributed locks must have expiration/leases.
- Never create a lock that can remain permanently stuck.
- Critical state must still be protected by database transactions/invariants.

## Input Validation

- Validate all untrusted input on the server.
- Reject malformed or unauthorized requests before business execution.
- Never trust client-calculated money, permissions, scheduling state, or billing state.

## Secrets

Never expose or log:

- Passwords
- Session secrets
- Reset tokens
- Verification codes
- API keys
- Payment secrets
- AI provider credentials

## Errors

- Return safe client-facing errors.
- Do not expose stack traces, SQL errors, internal paths, or secrets.

## Flutterwave

- Verify webhook authenticity according to the provider integration.
- Treat webhooks as untrusted until verified.
- Persist provider event IDs.
- Deduplicate repeated events.
- Handle retries and out-of-order events safely.

## Audit

Security-sensitive and important business actions should be auditable.

Audit logs must not contain secrets.

## AI Security

AI providers must never receive unnecessary sensitive data.

AI must not have unrestricted database/tool access.

AI output must be treated as untrusted input and pass normal authorization and business validation.

## Dependencies

Use trusted dependencies and keep security-sensitive dependencies updated.

## Failure Rule

A security rule is considered broken if an unauthorized user can:

- Access another business's data
- Modify another team's data
- Bypass a required permission
- Obtain secrets
- Execute a protected mutation without authorization