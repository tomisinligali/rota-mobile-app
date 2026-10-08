---
trigger: glob
---

# Money and Billing Rules

## Billing Boundary

- Billing belongs to the Business.
- A user does not own a subscription independently of the business.
- Billing state must not determine ownership of historical scheduling data.

## Billable Seats

MVP billing is primarily based on active staff seats.

- STAFF are billable by default.
- OWNER and MANAGER are non-billable by default unless the product explicitly changes this rule.
- Seat calculations must be performed from authoritative backend data.
- Never trust a client-provided seat count.

## Trial

- New businesses receive a 14-day trial.
- Trial state must be stored and calculated authoritatively.

## Grace Period

- Billing failure begins a 7-day grace period.
- During grace, scheduling data must remain intact.
- After grace, the business enters restricted mode according to product rules.
- Restriction must not delete historical scheduling data.

## Payment Provider

Flutterwave is the locked MVP payment provider.

- Keep Flutterwave-specific logic behind a billing integration boundary.
- Do not spread Flutterwave-specific code throughout the domain.
- Provider-specific IDs must not replace internal billing identifiers.

## Money Representation

- Store money as integer smallest currency units.
- Never use floating-point numbers for authoritative monetary values.
- Store currency explicitly where necessary.

## Transactions

Billing state changes that must be atomic must occur inside database transactions.

Do not update only part of a billing operation.

## Webhooks

Flutterwave webhooks are at-least-once.

Therefore:

- Verify webhook authenticity.
- Persist provider event IDs.
- Reject/deduplicate already processed events.
- Handle retries safely.
- Handle events arriving out of order.
- Do not assume webhook delivery order.
- Support reconciliation when provider state and local state disagree.

## Provider Failures

A timeout from Flutterwave does not automatically mean a payment failed.

Provider uncertainty must be represented safely until the result is known.

## Billing Authorization

Billing management is restricted to the appropriate business owner/authorized role.

## Audit

Record important billing state changes and payment events for traceability.

Never store payment secrets in audit records.

## Data Preservation

Billing failures must never cause deletion of:

- Shifts
- Scheduling history
- Audit history
- Other business records required for continuity

## Failure Rule

Billing is incorrect if:

- The wrong business is charged.
- The wrong amount is charged because of floating-point calculations.
- The same provider event creates duplicate state changes.
- A retry creates duplicate payment effects.
- A webhook changes billing without verification.
- Billing failure deletes scheduling history.