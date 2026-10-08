---
trigger: always_on
---

# Notification and Job Processing Rules

## Queue

- BullMQ running on Redis is the required background queue.
- Do not introduce another queue system when BullMQ is sufficient.
- Redis is infrastructure, not the durable business source of truth.

## Job States

Application-level job tracking should support:

- PENDING
- PROCESSING
- SUCCEEDED
- FAILED
- DEAD

## Atomic Claiming

Workers must claim jobs atomically.

Two workers must not process the same job as the active owner at the same time unless duplicate execution is explicitly tolerated and safely idempotent.

## Concurrency

Worker concurrency must be bounded.

Concurrency limits must be configurable.

## Retries

Use:

- Bounded retries
- Exponential backoff
- Jitter

Do not retry indefinitely.

## Idempotency

Every retryable job must be safe to execute more than once.

Repeated execution must not create duplicate:

- Notifications
- Billing effects
- Scheduling effects
- AI actions
- Other business side effects

## Stuck Jobs

Jobs left in `PROCESSING` because a worker crashes must be recoverable.

Use lease/timeout/stuck-job recovery logic.

A crashed worker must not permanently block a job.

## Dead Jobs

Jobs that exhaust retries must become inspectable `DEAD` jobs.

Dead jobs should support controlled manual retry where appropriate.

Manual retry must still obey idempotency and current-state validation.

## Notification Intent

Important notifications should first have durable intent recorded before asynchronous delivery.

Scheduling success must not depend on synchronous notification delivery.

## Transactional Boundary

For important business events:

1. Commit the business state change.
2. Persist durable notification/outbox intent as part of the required atomic operation.
3. Process delivery asynchronously.

Do not let a provider failure roll back an otherwise valid scheduling transaction.

## Provider Failures

Notification providers may fail, timeout, or return errors.

Workers must handle these failures through bounded retry/recovery logic.

## Stale Jobs

Before executing a job, validate relevant current state when the operation depends on mutable data.

Do not blindly execute a stale job against outdated assumptions.

## Billing Jobs

Billing jobs follow the same rules:

- Idempotent
- Retry-safe
- Deduplicated
- Provider failures handled safely
- No duplicate payment effects

## AI Jobs

AI jobs must follow the AI pipeline rules.

AI output remains untrusted.

AI jobs cannot bypass authorization or business validation.

## Payloads

Job payloads should contain stable identifiers and minimal necessary data.

Prefer re-reading current authoritative state rather than storing large mutable snapshots in the queue.

## Observability

Track enough information to diagnose:

- Job ID
- Type
- State
- Attempts
- Failure reason
- Relevant timestamps
- Correlation/request ID where appropriate

Never log secrets or sensitive credentials.

## Failure Rule

Job processing is broken if:

- A job is permanently stuck after worker failure.
- Retries create duplicate business effects.
- Important notification intent is lost.
- Two workers cause an unsafe duplicate operation.
- Failed jobs disappear without a recovery path.
- A background worker bypasses normal business rules.