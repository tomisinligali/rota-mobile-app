---
name: idempotent-mutation-workflow
description: Make retry-sensitive Rota mutations safe using Idempotency-Key, duplicate detection, replay handling, and concurrency protection.
---

# Idempotent Mutation Workflow

## Trigger

Use this skill when implementing or modifying:

- Retry-safe mutations
- `Idempotency-Key`
- Duplicate requests
- Replay handling

## Source of Truth

Before implementation:

1. Read `AGENTS.md`.
2. Read the PRD.
3. Read `.agents/rules/coding-standard.md`.
4. Read `.agents/rules/database-schema.md`.
5. Read `.agents/rules/security.md`.

## When Required

Use idempotency for retry-sensitive mutations where repeating the request could create duplicate business effects.

Examples include:

- Creating shifts
- Schedule publication
- Swap/claim operations
- Membership operations
- Billing-related mutations
- Other explicitly retry-sensitive mutations

## Key Semantics

For the same idempotency scope:

### Same Key + Same Request

Return the original result.

### Same Key + Different Request

Reject the request as a conflict.

Never allow one key to represent two different mutations.

## Scope

Idempotency records must be scoped appropriately to prevent unrelated users/businesses from colliding.

Do not assume the key is globally unique unless the data model explicitly guarantees it.

## Persistence

Do not rely only on:

- Memory
- Client-side storage
- Redis cache

Persist idempotency state durably when required to guarantee replay safety.

## Concurrency

Two simultaneous requests using the same key must not both execute the mutation.

Use appropriate database uniqueness/transactional protection.

## Transaction Boundary

Where appropriate:

1. Validate request.
2. Validate authorization.
3. Resolve idempotency key.
4. Establish ownership of the key.
5. Execute the business mutation transactionally.
6. Persist the result required for replay.
7. Return the result.

## Replay

A replay must return the original mutation result according to the established API contract.

Do not accidentally execute the mutation again.

## Authorization

Idempotency does not replace authorization.

Always apply the normal security boundary.

## Database Backstops

Use database uniqueness constraints where applicable to prevent duplicate records even if application-level idempotency fails.

## External Providers

When an external provider supports its own idempotency/deduplication mechanism, use it where appropriate.

Do not assume local idempotency alone prevents external duplicate effects.

## Error Handling

Define replay behavior for failed requests.

Do not permanently cache a transient infrastructure failure as a successful business result.

Do not turn a failed mutation into a false success.

## Testing

Test:

- Same key + same request
- Same key + different request
- Concurrent duplicate requests
- Retry after success
- Retry after transient failure
- Process crash during mutation
- Database constraint backstop

## Failure Conditions

The implementation fails if retries can create duplicate:

- Shifts
- Memberships
- Swaps
- Claims
- Payments
- Jobs
- Other durable business effects