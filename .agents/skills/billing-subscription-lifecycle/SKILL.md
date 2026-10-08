---
name: billing-subscription-lifecycle
description: Handle Rota trials, subscriptions, seat billing, Flutterwave payments and webhooks, grace periods, and restricted mode.
---

# Billing Subscription Lifecycle

## Trigger

Use this skill when implementing or modifying:

- Trial
- Subscription state
- Seat billing
- Flutterwave payments
- Flutterwave webhooks
- Grace period
- Restricted mode

## Source of Truth

Before implementation:

1. Read `AGENTS.md`.
2. Read the PRD.
3. Read `.agents/rules/money-billing.md`.
4. Read `.agents/rules/database-schema.md`.
5. Read `.agents/rules/security.md`.
6. Read `.agents/rules/notification-job-processing.md`.

## Billing Boundary

Business is the billing boundary.

A subscription belongs to the Business, not an individual user.

## Trial

MVP includes:

- 14-day trial

Trial state must be calculated from authoritative server/database state.

Do not trust client-provided trial dates.

## Seat Billing

Billing is primarily based on active STAFF seats.

By default:

- STAFF = billable
- OWNER = non-billable
- MANAGER = non-billable

Seat counts must be calculated by the backend from authoritative membership state.

Never trust client-provided seat counts.

## Money

- Store money as integer smallest currency units.
- Never use floating point for authoritative money.
- Store currency explicitly where required.
- Keep billing calculations deterministic.

## Flutterwave

Flutterwave is the locked MVP payment provider.

Provider-specific implementation must remain behind the billing integration boundary.

Do not spread Flutterwave-specific behavior throughout the domain.

## Webhooks

Flutterwave webhooks are at-least-once.

Therefore:

- Verify webhook authenticity.
- Persist provider event IDs.
- Deduplicate repeated events.
- Handle retries safely.
- Handle out-of-order events.
- Reconcile provider state against local state when necessary.

Never apply an unverified webhook to billing state.

## Payment Uncertainty

A timeout or provider error does not automatically prove payment failure.

Represent uncertain states safely until authoritative provider information is available.

## Grace Period

Billing failure creates a:

- 7-day grace period

During grace:

- Preserve business data.
- Preserve scheduling history.
- Preserve audit history.

After grace:

- Enter the defined restricted mode.
- Do not delete scheduling history.

## Restricted Mode

Restricted mode must be enforced by the backend.

Do not rely only on hiding UI controls.

## Transactions

Use database transactions for billing state changes that must be atomic.

## Authorization

Billing management must only be available to the authorized Business role.

## Audit

Audit important:

- Subscription changes
- Payment events
- Billing state changes
- Grace-period transitions
- Restricted-mode transitions

Never store payment secrets in audit logs.

## Testing

Test:

- Trial creation
- Trial expiration
- Seat calculation
- Subscription activation
- Payment success
- Payment failure
- Duplicate webhook
- Out-of-order webhook
- Unverified webhook
- Grace period
- Restricted mode
- Historical data preservation

## Failure Conditions

The implementation fails if:

- The wrong Business is charged.
- The wrong amount is calculated.
- Floating-point money causes incorrect billing.
- Duplicate webhooks cause duplicate effects.
- Unverified webhooks modify billing.
- Payment uncertainty is treated incorrectly.
- Billing failure deletes scheduling history.