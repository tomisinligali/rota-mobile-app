# Rota Subscription Billing & Proration Engine Documentation

This document describes the exact pricing structure, deterministic proration engine, rounding rules, ledger architecture, and subscription lifecycle in Rota.

---

## 1. Plan Pricing Structure

All monetary figures in Rota are strictly stored and computed as **whole integer cents** (never floating-point numbers) to eliminate rounding drift and financial calculation discrepancies.

| Plan Tier | Base Price / Month | Base Seats Included | Extra Seat Price / Month | Max Capacity |
| :--- | :--- | :--- | :--- | :--- |
| **Starter** | $20.00 (`2000` cents) | Up to 5 seats | *Not available* | 5 seats max |
| **Team** | $50.00 (`5000` cents) | Up to 15 seats | $3.00 (`300` cents) per seat | Unlimited |
| **Business** | $120.00 (`12000` cents) | Up to 40 seats | $2.00 (`200` cents) per seat | Unlimited |

### Monthly Plan Cost Calculation

Given a plan tier $T$ and requested seat count $S$:
- If $T = \text{STARTER}$:
  - If $S > 5$, the configuration is rejected with `SEAT_LIMIT_EXCEEDED` ($400$). Extra seats are not permitted.
  - $\text{Cost}(T, S) = 2000\text{ cents}$.
- If $T = \text{TEAM}$:
  - Extra seats: $E = \max(0, S - 15)$.
  - $\text{Cost}(T, S) = 5000 + (E \times 300)\text{ cents}$.
- If $T = \text{BUSINESS}$:
  - Extra seats: $E = \max(0, S - 40)$.
  - $\text{Cost}(T, S) = 12000 + (E \times 200)\text{ cents}$.

---

## 2. Deterministic Proration Engine

Proration calculates the fair balance when a business upgrades, adds seats, downgrades, or reduces seats mid-cycle.

### Cycle Parameters
- $D_{\text{total}}$: Total days in the current billing cycle ($\max(1, \text{days})$).
- $D_{\text{remaining}}$: Days remaining until period end ($\max(0, \text{days})$).
- $C_{\text{old}}$: Full monthly cost of current plan and seats (in cents).
- $C_{\text{new}}$: Full monthly cost of new plan and seats (in cents).

### Rounding Rules & Formulas
All fractional calculations are rounded **down** to the nearest whole cent using `Math.floor`:

1. **Credit for unused time on current plan**:
   $$\text{Credit}_{\text{unused}} = \left\lfloor \frac{C_{\text{old}} \times D_{\text{remaining}}}{D_{\text{total}}} \right\rfloor$$

2. **Cost for new plan over remaining time**:
   $$\text{Cost}_{\text{remaining}} = \left\lfloor \frac{C_{\text{new}} \times D_{\text{remaining}}}{D_{\text{total}}} \right\rfloor$$

3. **Immediate Charge vs. Scheduled Downgrade**:
   - **Upgrades & Seat Additions** ($C_{\text{new}} \ge C_{\text{old}}$):
     $$\text{Charge}_{\text{today}} = \max(0, \text{Cost}_{\text{remaining}} - \text{Credit}_{\text{unused}})$$
     Applied immediately. The subscription plan and seat count update upon confirmation.
   - **Downgrades & Seat Reductions** ($C_{\text{new}} < C_{\text{old}}$):
     $$\text{Charge}_{\text{today}} = 0\text{ cents}$$
     To eliminate merchant refund risks, mid-cycle refunds are not issued. Instead, downgrades are **scheduled** to take effect at the end of the billing period (`current_period_end`). The customer retains access to their higher tier and seat allocation until the cycle expires.

---

## 3. Concrete Example: Ifeanyi's Café

### Scenario
1. **Day 1**: Ifeanyi subscribes to the **Starter** plan ($20.00 / 2000 cents, 5 seats included) for a 30-day period.
2. **Day 11**: He hires 4 more staff members (total 9 staff) and upgrades to the **Team** plan ($50.00 / 5000 cents, includes 15 seats).
3. **Days remaining**: $30 - 10 = 20\text{ days}$.

### Calculation
- Credit for unused Starter time:
  $$\text{Credit}_{\text{unused}} = \left\lfloor \frac{2000 \times 20}{30} \right\rfloor = \lfloor 1333.333... \rfloor = 1333\text{ cents}$$
- Cost of Team for remaining time:
  $$\text{Cost}_{\text{remaining}} = \left\lfloor \frac{5000 \times 20}{30} \right\rfloor = \lfloor 3333.333... \rfloor = 3333\text{ cents}$$
- **Charge Today**:
  $$\text{Charge}_{\text{today}} = 3333 - 1333 = 2000\text{ cents} \quad (\$20.00)$$
- **Next Renewal**:
  On the 1st of the next month, the full standard monthly charge of $50.00 (`5000` cents) is billed.

---

## 4. Immutable Billing Ledger (`billing_ledger`)

All financial events in Rota are written to an append-only ledger table.

### Ledger Schema
```sql
CREATE TABLE billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  entry_type ledger_entry_type NOT NULL, -- 'CHARGE', 'CREDIT', 'REFUND', 'CORRECTION'
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  description TEXT NOT NULL,
  idempotency_key VARCHAR(255),
  provider_event_id VARCHAR(255),
  provider_payment_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Invariants
1. **Append-Only Enforcement**: A PostgreSQL trigger `trg_billing_ledger_immutable` executes `prevent_ledger_mutation()` which unconditionally throws an exception on any `UPDATE` or `DELETE` attempt.
2. **State Rebuild**: Authoritative account balances and subscription financial state can be mathematically reconstituted by summing ledger entries:
   $$\text{NetPaid} = \sum \text{CHARGE} - \sum \text{REFUND}$$
3. **Idempotency**: All mutation requests carry an `Idempotency-Key` header. Duplicate submissions replay the recorded ledger entry and return the idempotent cached result without re-executing charges.

---

## 5. Server-Side Seat Limit Enforcement

Seat counts are strictly validated on the backend:
- When a business owner or manager creates a new staff invitation (`POST /api/v1/invitations`), the server computes:
  $$\text{UtilizedSeats} = \text{ActiveStaffCount} + \text{PendingInvitationsCount}$$
- If $\text{UtilizedSeats} \ge \text{SeatCount}$, the invitation is rejected with HTTP $403$ and error code `SEAT_LIMIT_REACHED`.
- Starter plans cannot invite a 6th person without first upgrading to Team.

---

## 6. Payment Webhook & Lifecycle Management

### Asynchronous Queueing
- Incoming Flutterwave webhooks are received at `/api/v1/billing/webhook`.
- Signature is verified against `verif-hash`.
- Valid webhooks are enqueued into a BullMQ queue (`billing-webhooks`) running on Redis with bounded exponential retries.
- Webhook endpoints respond with HTTP $200$ immediately.
- The worker executes `BillingService.processVerifiedWebhook()`.
- Deduplication is guaranteed using the `provider_event_id` field recorded in `billing_ledger`.

### Renewal Failure & Grace Period
- If a renewal payment fails, the subscription moves to `GRACE_PERIOD`.
- An asynchronous BullMQ job dispatches an email notification to the business owner detailing the 7-day grace window.
- A `CORRECTION` entry is appended to `billing_ledger`.
- During the 7-day grace period, existing schedules and shifts remain viewable and editable.
- If the 7-day period expires without successful renewal, the subscription enters `RESTRICTED` mode:
  - Existing scheduling history is **never** deleted.
  - Creating new shifts or modifying existing active shifts is blocked with HTTP $402$ `SUBSCRIPTION_RESTRICTED`.
  - Shift cancellation is permitted so managers can resolve existing schedules.
