---
trigger: always_on
---

# Coding Standards

## Core Rules

- Use TypeScript with strict type checking.
- Do not use `any` to bypass type safety.
- Follow the locked stack in `AGENTS.md`: React Native + Expo, Node.js LTS, Express, TypeScript, PostgreSQL, Redis, and BullMQ.
- Do not replace locked technologies without an explicit project decision.
- Backend code is authoritative for business rules.
- Mobile code must never connect directly to PostgreSQL or Redis for business operations.

## Backend

- Keep Express handlers thin.
- Put business logic in domain/service modules.
- Validate all client input on the server.
- Never trust client-provided authorization, role, price, billing, scheduling, or status values.
- Use typed application errors and consistent API error responses.
- API success responses use `{ data, meta }`.
- API errors use `{ error: { code, message, details } }`.
- API routes use `/api/v1`.

## Database

- PostgreSQL is the durable source of truth.
- Use transactions for operations that must succeed or fail atomically.
- Enforce critical invariants at the database and/or application transaction level.
- Never treat Redis as permanent storage.
- Never store money as floating-point values.
- Store money as integer smallest currency units.
- Store real timestamps and preserve the relevant IANA timezone.

## External Services

- Keep Flutterwave, notification providers, and AI providers behind integration boundaries.
- External providers must never directly control core domain state.
- Provider failures must be handled explicitly.
- Do not spread provider-specific logic throughout the domain.

## AI

- AI output is untrusted input.
- DeepSeek and Claude are providers, not sources of business truth.
- AI integrations must use a provider abstraction.
- AI must not directly modify the database.
- AI-generated actions must pass normal authorization, validation, business-rule checks, confirmation, transactions, and audit requirements.

## Security

- Never log passwords, session secrets, reset tokens, verification codes, API keys, payment secrets, or sensitive provider payloads.
- Secrets must come from secure configuration/environment variables.
- Do not expose internal errors or sensitive database information to clients.

## Testing

Critical business behavior must have automated tests, especially:

- Authentication and authorization
- Tenant isolation
- Scheduling conflicts
- Concurrent scheduling
- Shift swaps
- Billing/webhooks
- Idempotency
- Notifications/jobs
- AI validation

## Code Quality

- Do not duplicate critical business rules.
- Prefer small, focused modules.
- Do not introduce abstractions without a real requirement.
- Do not perform unrelated refactors while implementing a feature.
- Do not add Phase 2/3 functionality during MVP work unless explicitly authorized.