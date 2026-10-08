---
name: chedule-shift-lifecycle
description: Handle Rota schedule and shift creation, editing, recurring shifts, publication, cancellation, and historical preservation.
---

# Schedule Shift Lifecycle

## Trigger

Use this skill when implementing or modifying:

- Schedule creation
- Shift creation
- Shift editing
- Recurring shifts
- Schedule publication
- Shift cancellation
- Historical scheduling behavior

## Source of Truth

Before implementation:

1. Read `AGENTS.md`.
2. Read the PRD.
3. Read `.agents/rules/scheduling-integrity.md`.
4. Read `.agents/rules/database-schema.md`.
5. Read `.agents/rules/coding-standard.md`.
6. Read `.agents/rules/notification-job-processing.md`.

## Authority

- Backend is authoritative for scheduling.
- PostgreSQL is the durable source of truth.
- Mobile clients never connect directly to PostgreSQL.
- Client-side validation does not replace server-side validation.

## Shift Validation

Every shift must have:

- Valid team
- Authorized actor
- Valid start time
- Valid end time
- Start before end
- Correct timezone handling
- Valid assignment where applicable

Use actual timestamps as authoritative values.

Preserve the relevant IANA timezone.

## Shift Lifecycle

Use the established lifecycle:

- DRAFT
- PUBLISHED
- CANCELLED
- COMPLETED

Do not use deletion to represent cancellation when history must remain.

## Draft Shifts

Draft schedules can be edited by authorized users.

Draft changes must still obey:

- Authorization
- Validation
- Conflict rules
- Idempotency where required

## Publication

Publishing must be transactional.

A publication operation must not leave:

- Some shifts published
- Other required shifts unpublished
- Inconsistent schedule state

Notification delivery must not be required synchronously for publication to succeed.

## Cancellation

Published shifts should be cancelled rather than hard-deleted.

Cancellation must preserve historical information.

## Recurring Shifts

Treat recurrence definitions and actual generated shift instances appropriately.

When modifying recurrence:

- Clearly determine whether the change affects future instances.
- Do not silently rewrite historical instances.
- Preserve historical schedule integrity.

## Editing

Before modifying an existing shift:

- Verify authorization.
- Read current state.
- Check version/concurrency state.
- Revalidate conflicts.
- Apply the mutation transactionally when required.

Do not allow stale client data to silently overwrite newer data.

## Notifications

Schedule changes requiring notifications must create durable notification intent.

The scheduling transaction must not depend on external notification delivery.

Notification work should be processed asynchronously through BullMQ.

## Idempotency

Retry-sensitive schedule mutations must support `Idempotency-Key` where required.

Repeated requests must not create duplicate shifts or duplicate state changes.

## Historical Handling

Never delete scheduling history merely because:

- A staff member is deactivated.
- A Business is restricted due to billing.
- A shift is cancelled.
- A recurring schedule is changed.

## Testing

Test:

- Shift creation
- Shift editing
- Draft publication
- Cancellation
- Recurring shifts
- Historical preservation
- Concurrent edits
- Overlap protection
- Idempotent retries
- Notification intent creation

## Failure Conditions

The implementation fails if:

- Unauthorized users can modify schedules.
- Invalid times are accepted.
- Conflicting shifts can be created.
- Publication is partial.
- Stale data overwrites current data.
- Historical shifts disappear.
- Retries create duplicate shifts.