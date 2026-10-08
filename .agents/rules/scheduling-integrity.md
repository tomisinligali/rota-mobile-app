---
trigger: always_on
---

# Scheduling Integrity Rules

## Authority

- The backend is authoritative for all scheduling decisions.
- The mobile client must never directly modify scheduling data in PostgreSQL.
- Client availability information is not authoritative.

## Team Membership

A user may create, edit, publish, cancel, or otherwise modify shifts only when their current team membership and role authorize the operation.

## Shift Times

Every shift must have:

- Valid start time
- Valid end time
- Start before end
- Correct team/location timezone handling
- Actual timestamps stored authoritatively

## Overlap Protection

Where overlapping shifts are not allowed, enforce the rule transactionally.

Overlap condition:

`existing.start < new.end AND existing.end > new.start`

The check must be safe against concurrent requests.

Do not rely only on a client-side overlap check.

## Availability

Staff availability/preferences may be used as scheduling guidance.

Do not treat them as the only protection against invalid schedules unless explicitly required by product rules.

## Shift Lifecycle

Core lifecycle:

- DRAFT
- PUBLISHED
- CANCELLED
- COMPLETED

Do not treat cancellation as deletion.

## Publication

Publishing a schedule must be transactional.

The system must not leave a partially published schedule.

Notification delivery must not be required to complete synchronously before the schedule itself is committed.

## Concurrency

Use optimistic concurrency/version checks or equivalent protection so stale clients cannot silently overwrite newer scheduling changes.

Concurrent schedule modifications must re-check current database state.

## Recurring Shifts

Keep recurrence definitions separate from actual generated shifts when appropriate.

Changes to a recurrence must clearly define whether they affect:

- Future instances
- Existing instances
- Historical instances

Never silently rewrite historical scheduling data.

## Cancellation

Published shifts should be cancelled rather than hard-deleted.

Historical scheduling information must remain available.

## Notifications

Schedule changes should create durable notification intent/outbox work.

Notification delivery must occur asynchronously through the job system.

A notification provider failure must not roll back an already valid scheduling transaction.

## Idempotency

Retry-sensitive scheduling mutations must support idempotency where required.

Repeated requests must not create duplicate shifts or duplicate state changes.

## Authorization

UI visibility is not authorization.

Every scheduling mutation must be authorized by the backend.

## Failure Rule

Scheduling integrity is broken if:

- Two conflicting shifts are created through concurrent requests.
- A user modifies another team's schedule.
- A stale client overwrites a newer change.
- A published shift disappears instead of being preserved/cancelled.
- A schedule is partially published.
- A retry creates duplicate scheduling records.