---
name: notification-job-processing
description: Handle Rota notifications, BullMQ jobs, durable outbox work, retries, stuck-job recovery, and external delivery.
---

# Notification Job Processing

## Trigger

Use this skill when implementing or modifying:

- Notifications
- BullMQ jobs
- Outbox work
- Retries
- Stuck jobs
- External notification delivery

## Source of Truth

Before implementation:

1. Read `AGENTS.md`.
2. Read the PRD.
3. Read `.agents/rules/notification-job-processing.md`.
4. Read `.agents/rules/database-schema.md`.
5. Read `.agents/rules/coding-standard.md`.

## Queue

BullMQ running on Redis is the required queue.

Do not introduce another queue system when BullMQ is sufficient.

Redis is not the durable business source of truth.

## Job States

Application-level job tracking uses:

- PENDING
- PROCESSING
- SUCCEEDED
- FAILED
- DEAD

## Durable Intent

Important notification work must not exist only in an in-memory queue.

Persist durable notification/outbox intent as part of the appropriate business transaction.

The business transaction must not depend on successful external delivery.

## Worker Processing

Workers must:

1. Receive/claim a job.
2. Safely establish processing ownership.
3. Re-read current state when required.
4. Execute the operation idempotently.
5. Mark the result.
6. Retry bounded failures.
7. Recover stuck work.

## Concurrency

Worker concurrency must be bounded and configurable.

Critical operations must remain safe even when multiple workers execute simultaneously.

## Retries

Use:

- Bounded retry count
- Exponential backoff
- Jitter

Never retry indefinitely.

## Idempotency

Jobs must be safe to execute more than once.

Retries must not create duplicate:

- Notifications
- Billing effects
- Scheduling effects
- AI effects
- Other business mutations

## Stuck Jobs

A worker may crash while a job is `PROCESSING`.

The system must detect and recover stuck work using a lease/timeout/recovery mechanism.

A crashed worker must not permanently block the job.

## Dead Jobs

After retry exhaustion:

- Mark the job DEAD.
- Preserve enough information for diagnosis.
- Make the job inspectable.
- Allow controlled manual retry where appropriate.

Manual retries must still obey idempotency and current-state validation.

## External Delivery

External notification providers may:

- Fail
- Timeout
- Reject delivery
- Become temporarily unavailable

Handle these through the retry/recovery workflow.

Do not roll back a successful scheduling/business transaction because notification delivery failed.

## Current State

For jobs based on mutable business state:

- Prefer stable IDs in job payloads.
- Re-read current authoritative state.
- Do not blindly execute stale snapshots.

## Observability

Track enough information to diagnose:

- Job ID
- Job type
- State
- Attempts
- Failure reason
- Created/updated timestamps
- Correlation/request ID where appropriate

Never log secrets.

## Testing

Test:

- Normal job execution
- Retry
- Duplicate execution
- Worker crash
- Stuck-job recovery
- Dead-letter behavior
- Manual retry
- Concurrent workers
- External provider failure
- Notification intent durability

## Failure Conditions

The implementation fails if:

- Notification intent can be lost.
- Retries duplicate business effects.
- PROCESSING jobs remain stuck permanently.
- Dead jobs disappear.
- Multiple workers cause unsafe duplicate effects.
- External provider failure corrupts the underlying business transaction.