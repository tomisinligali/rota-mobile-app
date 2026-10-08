---
name: shift-swap-workflow
description: Handle Rota direct swaps, open shifts, claims, approval/rejection, and final assignment changes safely.
---

# Shift Swap Workflow

## Trigger

Use this skill when implementing or modifying:

- Direct swaps
- Open shifts
- Claims
- Approval
- Rejection
- Assignment changes

## Source of Truth

Before implementation:

1. Read `AGENTS.md`.
2. Read the PRD.
3. Read `.agents/rules/shift-swap-workflow.md`.
4. Read `.agents/rules/scheduling-integrity.md`.
5. Read `.agents/rules/scheduling-conflict-concurrency.md`.
6. Read `.agents/rules/idempotent-mutation-workflow.md`.

## Workflow Types

Treat these as separate workflows:

### Direct Swap

An assigned staff member proposes another eligible staff member as the replacement.

### Open Shift

A shift is made available for eligible staff to claim.

Do not merge the two workflows into one generic state machine if their business rules differ.

## Eligibility

Before creating or executing a swap/claim, verify current:

- User
- Business
- Team membership
- Role
- Shift assignment
- Shift status
- Shift timing
- Existing swap/claim state
- Scheduling conflicts

## Started Shifts

Do not create new swap requests for shifts that have already started unless the PRD explicitly permits it.

## Approval

Where manager approval is required:

- Only authorized OWNER/MANAGER users may approve/reject.
- Approval must use current database state.
- Revalidate eligibility.
- Revalidate shift status.
- Revalidate conflicts.
- Revalidate that the requested swap/claim is still valid.

## Atomic Approval

If approval immediately changes the final assignment:

- Perform approval and assignment execution atomically.
- Do not create a misleading durable `APPROVED` state that depends on a later unreliable execution step.

## Concurrent Claims

Multiple users may attempt to claim an open shift simultaneously.

The backend must guarantee that only one valid final claim succeeds.

Use database-safe concurrency protection.

## Idempotency

Protect against:

- Duplicate swap creation
- Duplicate claims
- Duplicate approval requests
- Duplicate assignment changes

Use `Idempotency-Key` where required.

## Scheduling Integrity

A swap must not bypass normal scheduling conflict rules.

The resulting assignment must be validated against the current schedule.

## Notifications

Swap events may create notification/outbox work.

Notification delivery is asynchronous.

A notification failure must not corrupt an otherwise valid schedule transaction.

## Audit

Record important events such as:

- Swap created
- Claim made
- Approval
- Rejection
- Cancellation
- Assignment change

Preserve enough history to understand how the final assignment occurred.

## Testing

Test:

- Valid direct swap
- Invalid recipient
- Open-shift claim
- Two simultaneous claims
- Approval
- Rejection
- Stale approval
- Started-shift restriction
- Duplicate request
- Assignment conflict
- Historical audit

## Failure Conditions

The implementation fails if:

- Unauthorized users execute swaps.
- Two users successfully claim the same open shift.
- Approval uses stale/conflicting data.
- Retries create duplicate assignments.
- Swap history cannot explain the final schedule.