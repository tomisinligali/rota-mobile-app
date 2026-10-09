# Security

Eight key threats to the Rota app and how the codebase handles each.

## 1. Cross-tenant data access (IDOR)

A user reading or mutating another business's or team's data by guessing IDs.

**Handled by:** never trusting client-supplied `businessId`/`teamId` as proof of
access. Authorization is derived from the authenticated user's team memberships
on the backend for every protected operation. Object-level checks confirm the
target record belongs to the caller's team before read or mutation. Tenant
isolation is covered by the security test suite.

## 2. Role escalation

A staff member performing manager/owner actions, or a manager touching teams
they do not belong to.

**Handled by:** team-scoped roles (`OWNER`/`MANAGER`/`STAFF`) stored on the team
membership, never as a single global role on the user. Route handlers carry the
request through authentication → authorization → validation before any domain
service runs. The mobile UI is never trusted as an access control layer.

## 3. Credential theft / weak authentication

Attacking accounts via weak password hashing, guessable sessions, or brute force.

**Handled by:** email/password auth with Argon2id password hashing, and
server-controlled sessions backed by refresh tokens (migration 011). Login,
registration, password reset, and other sensitive endpoints are protected by a
rate-limiting middleware.

## 4. Account takeover via verification / reset abuse

Reusing or guessing email-verification or password-reset secrets.

**Handled by:** verification and reset secrets that are single-use and
time-limited, generated with `crypto.randomBytes()` (never `Math.random()` or
`randomInt()`). A request-validation middleware enforces input shape before
these flows proceed, and consumed/expired secrets are rejected.

## 5. Scheduling overlap and integrity

Double-booking staff, or a stale client overwriting a newer schedule edit.

**Handled by:** shift overlap enforced in application validation with
optimistic concurrency/versioning on mutable scheduling records, backed by
PostgreSQL constraints as a final integrity layer. Confirmed/published shifts
are cancelled, never hard-deleted, so history is preserved.

## 6. Swap execution races

Two competing swap approvals producing contradictory assignments, or a swap
finalizing on stale shift/membership state.

**Handled by:** approval and assignment change happen atomically inside one
transaction that revalidates current shift and membership state before
applying. Manager approval is required before a swap becomes final, and
retries cannot duplicate assignment effects.

## 7. Billing webhook replay and forgery

Duplicate or forged Flutterwave webhooks creating duplicate subscription effects.

**Handled by:** webhook authenticity validated before any effect is applied,
provider event IDs persisted and deduplicated (at-least-once safe), and effects
never keyed off client-side billing state. Flutterwave integration stays behind
a provider boundary so webhook shapes never leak into the core domain.

## 8. Secret leakage and unsafe error output

Passwords, session secrets, payment secrets, or stack traces reaching logs,
responses, or audit records.

**Handled by:** secrets never logged, echoed in API responses, or stored in
audit records. Errors use a stable envelope with no stack traces or internal
detail. `.env` files are git-ignored, and any dev fallbacks are clearly flagged
as replace-in-production.