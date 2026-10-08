---
name: scheduling-conflict-concurrency
description: Protect Rota scheduling against overlapping shifts, concurrent edits, stale versions, and publication races.
---

# Scheduling Conflict Concurrency

## Trigger

Use this skill when implementing or modifying:

- Shift overlap checks
- Concurrent schedule edits
- Stale versions
- Publication races
- Concurrent schedule mutations

## Source of Truth

Before implementation:

1. Read `AGENTS.md`.
2. Read the PRD.
3. Read `.agents/rules/scheduling-integrity.md`.
4. Read `.agents/rules/database-schema.md`.
5. Read `.agents/rules/coding-standard.md`.

## Overlap Rule

Where overlapping shifts are prohibited, use:

`existing.start < new.end AND existing.end > new.start`

Do not rely solely on client-side overlap checks.

## Concurrency Requirement

The conflict check must remain correct when multiple requests happen simultaneously.

A safe implementation must use appropriate:

- Database constraints
- Transactions
- Locks
- Serializable/appropriate isolation
- Optimistic concurrency
- Or an equivalent database-safe mechanism

Do not assume sequential requests.

## Stale Versions

When versioning is used:

- Client sends the version it last read.
- Backend compares it against authoritative current state.
- A stale mutation must not silently overwrite newer data.
- Return a clear conflict response when the version is stale.

## Publication Races

Publication must be atomic.

If two users attempt to publish or modify the same schedule concurrently:

- Revalidate current state.
- Prevent contradictory state.
- Prevent partial publication.
- Ensure only valid current state is committed.

## Transaction Pattern

For critical schedule mutations:

1. Authenticate.
2. Authorize.
3. Begin transaction.
4. Read/re-read authoritative state.
5. Check version.
6. Check conflicts.
7. Apply mutation.
8. Persist required durable side effects/outbox intent.
9. Commit.
10. Process external delivery asynchronously.

## Redis

Redis may support distributed locks where appropriate.

Redis is not the durable source of truth.

Database state must remain authoritative.

Locks must have expiration/lease behavior so crashes cannot permanently block scheduling.

## Idempotency

Where a mutation supports `Idempotency-Key`:

- Same key + same request = original result.
- Same key + different request = conflict.
- Concurrent duplicate requests must not create duplicate effects.

## Testing

Explicitly test:

- Two overlapping shift requests at the same time.
- Two edits to the same shift.
- Stale version update.
- Two simultaneous publication attempts.
- Retry of a successful mutation.
- Worker/process failure during a protected operation.

## Failure Conditions

The implementation fails if:

- Concurrent requests create prohibited overlaps.
- Stale clients overwrite current schedules.
- Publication becomes partially applied.
- A lock can remain permanently stuck.
- Duplicate requests create duplicate scheduling effects.