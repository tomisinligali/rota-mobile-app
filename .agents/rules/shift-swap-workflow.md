---
trigger: always_on
---

# Shift Swap Workflow Rules

## Swap Types

Rota has two distinct workflows:

1. Direct shift swap
2. Open shift

Do not merge their business rules.

## Eligibility

Before creating or claiming a swap/open shift, verify current:

- User
- Team membership
- Role
- Shift ownership/assignment
- Shift status
- Timing
- Existing swap/open-shift state

## Started Shifts

Do not create new swap requests for shifts that have already started unless the product explicitly authorizes that behavior.

## Direct Swap

A direct swap involves an assigned staff member proposing a replacement/recipient.

The proposed recipient must satisfy the relevant eligibility rules.

## Open Shift

An open shift may be claimed by an eligible staff member.

Multiple users may attempt to claim the same open shift concurrently.

The backend must ensure only one valid claim can succeed.

## Manager Approval

Where manager approval is required:

- Approval must be performed by an authorized manager/owner.
- Approval must re-read current database state.
- Approval must revalidate eligibility, shift status, timing, and conflicts.
- Approval must happen transactionally with the final state change where appropriate.

Do not approve based only on stale data.

## Atomic Execution

If approval immediately completes the swap/assignment, prefer one atomic transaction instead of creating a misleading durable `APPROVED` state followed by a separate unreliable execution step.

## Concurrency

Protect against:

- Two users claiming the same open shift.
- A shift being changed while a swap is approved.
- A user becoming ineligible during the workflow.
- Duplicate approval requests.
- Duplicate swap submissions.

## Idempotency

Retrying the same request must not create duplicate swaps, claims, or assignments.

## Cancellation

Swap cancellation must follow explicit authorization rules.

Do not silently alter historical scheduling data.

## Notifications

Swap/open-shift events should generate durable notification intent.

Delivery occurs asynchronously through BullMQ.

Notification failure must not corrupt the underlying scheduling transaction.

## Audit

Important swap events should be auditable, including:

- Creation
- Claim
- Approval
- Rejection
- Cancellation
- Final assignment change

## Historical Integrity

The final schedule must remain historically understandable.

Do not delete records required to explain how a shift assignment changed.

## Failure Rule

The workflow is broken if:

- An unauthorized person completes a swap.
- Two people successfully claim one open shift.
- Approval succeeds using stale/conflicting data.
- A retry creates duplicate assignments.
- Swap history becomes impossible to reconstruct.