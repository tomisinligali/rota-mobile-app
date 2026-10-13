import { pool, poolAdapter, query } from '../../db/pool';
import {
  PLAN_CONFIG,
  PlanTier,
  calculateMonthlyPlanCostCents,
  calculateProration,
  ProrationResult,
} from './proration';
import { EmailService } from '../notifications/email.service';

export interface SubscriptionData {
  id: string;
  businessId: string;
  planTier: PlanTier;
  planDetails: (typeof PLAN_CONFIG)[PlanTier];
  seatCount: number;
  activeStaffCount: number;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'GRACE_PERIOD' | 'RESTRICTED' | 'CANCELLED';
  unitPriceCents: number;
  currency: string;
  trialStartsAt: string;
  trialEndsAt: string;
  trialDaysRemaining: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cycleDaysRemaining: number;
  gracePeriodEndsAt: string | null;
  scheduledDowngrade?: {
    planTier: PlanTier;
    seatCount: number;
    effectiveAt: string;
  } | null;
  availablePlans: (typeof PLAN_CONFIG)[PlanTier][];
  recentLedgerEntries: any[];
}

export class BillingService {
  /**
   * Retrieves the authoritative subscription and staff seat usage for a business.
   * Auto-enforces grace-period expiration into RESTRICTED status.
   */
  static async getSubscription(businessId: string): Promise<SubscriptionData> {
    const subRes = await query(
      `SELECT id, business_id, plan_tier, seat_count, status, unit_price_cents, currency,
              trial_starts_at, trial_ends_at, current_period_start, current_period_end,
              grace_period_ends_at, scheduled_plan_tier, scheduled_seat_count, scheduled_effective_at,
              created_at, updated_at
       FROM subscriptions WHERE business_id = $1`,
      [businessId]
    );

    let sub: any;
    if (subRes.rowCount === 0) {
      // Auto-create initial 14-day Starter trial if missing
      const initRes = await query(
        `INSERT INTO subscriptions 
          (business_id, plan_tier, seat_count, status, unit_price_cents, currency, trial_starts_at, trial_ends_at)
         VALUES ($1, 'STARTER', 5, 'TRIALING', 2000, 'USD', NOW(), NOW() + INTERVAL '14 days')
         RETURNING *`,
        [businessId]
      );
      sub = initRes.rows[0];
    } else {
      sub = subRes.rows[0];
    }

    // Check if GRACE_PERIOD has expired into RESTRICTED status
    if (sub.status === 'GRACE_PERIOD' && sub.grace_period_ends_at) {
      const graceEnd = new Date(sub.grace_period_ends_at).getTime();
      if (Date.now() > graceEnd) {
        await query(
          `UPDATE subscriptions SET status = 'RESTRICTED', updated_at = NOW() WHERE id = $1`,
          [sub.id]
        );
        sub.status = 'RESTRICTED';
      }
    }

    return this.formatSubscriptionData(sub, businessId);
  }

  private static async formatSubscriptionData(sub: any, businessId: string): Promise<SubscriptionData> {
    // Count active billable STAFF seats authoritatively
    const countRes = await query(
      `SELECT COUNT(DISTINCT tm.user_id) as active_staff
       FROM team_memberships tm
       JOIN teams t ON t.id = tm.team_id
       WHERE t.business_id = $1 AND tm.role = 'STAFF' AND tm.status = 'ACTIVE'`,
      [businessId]
    );

    const activeStaffCount = parseInt(countRes.rows[0]?.active_staff || '0', 10);
    const now = Date.now();
    const trialEnd = new Date(sub.trial_ends_at).getTime();
    const trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 3600 * 24)));

    const periodEnd = new Date(sub.current_period_end).getTime();
    const cycleDaysRemaining = Math.max(0, Math.ceil((periodEnd - now) / (1000 * 3600 * 24)));

    // Fetch immutable ledger entries
    const ledgerRes = await query(
      `SELECT id, entry_type, amount_cents, currency, description, idempotency_key, provider_payment_id, created_at
       FROM billing_ledger
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [businessId]
    );

    const currentPlanConfig = PLAN_CONFIG[sub.plan_tier as PlanTier] || PLAN_CONFIG.STARTER;

    return {
      id: sub.id,
      businessId: sub.business_id,
      planTier: sub.plan_tier,
      planDetails: currentPlanConfig,
      seatCount: sub.seat_count,
      activeStaffCount,
      status: sub.status,
      unitPriceCents: sub.unit_price_cents,
      currency: sub.currency,
      trialStartsAt: sub.trial_starts_at,
      trialEndsAt: sub.trial_ends_at,
      trialDaysRemaining,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cycleDaysRemaining,
      gracePeriodEndsAt: sub.grace_period_ends_at,
      scheduledDowngrade: sub.scheduled_plan_tier
        ? {
            planTier: sub.scheduled_plan_tier,
            seatCount: sub.scheduled_seat_count,
            effectiveAt: sub.scheduled_effective_at,
          }
        : null,
      availablePlans: Object.values(PLAN_CONFIG),
      recentLedgerEntries: ledgerRes.rows,
    };
  }

  /**
   * Previews mid-cycle proration using the server-side proration engine.
   * Calculations are strictly integer cents with Math.floor rounding.
   */
  static async previewProration(
    businessId: string,
    input: { newPlanTier: PlanTier; newSeatCount: number }
  ): Promise<ProrationResult> {
    const { newPlanTier, newSeatCount } = input;
    const targetPlan = PLAN_CONFIG[newPlanTier];
    if (!targetPlan) {
      const err: any = new Error(`Invalid plan tier: ${newPlanTier}`);
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    if (newPlanTier === 'STARTER' && newSeatCount > 5) {
      const err: any = new Error('Starter plan includes up to 5 seats. Extra seats are not available.');
      err.code = 'SEAT_LIMIT_EXCEEDED';
      err.status = 400;
      throw err;
    }

    // Active staff seats check - cannot reduce below currently active staff
    const countRes = await query(
      `SELECT COUNT(DISTINCT tm.user_id) as active_staff
       FROM team_memberships tm
       JOIN teams t ON t.id = tm.team_id
       WHERE t.business_id = $1 AND tm.role = 'STAFF' AND tm.status = 'ACTIVE'`,
      [businessId]
    );
    const activeStaffCount = parseInt(countRes.rows[0]?.active_staff || '0', 10);

    if (newSeatCount < activeStaffCount) {
      const err: any = new Error(
        `Cannot reduce seats to ${newSeatCount}. You currently have ${activeStaffCount} active staff members.`
      );
      err.code = 'SEAT_LIMIT_EXCEEDED';
      err.status = 400;
      throw err;
    }

    const subRes = await query(
      `SELECT plan_tier, seat_count, current_period_start, current_period_end
       FROM subscriptions WHERE business_id = $1`,
      [businessId]
    );

    if (subRes.rowCount === 0) {
      const err: any = new Error('Subscription not found');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const sub = subRes.rows[0];
    const periodStart = new Date(sub.current_period_start).getTime();
    const periodEnd = new Date(sub.current_period_end).getTime();
    const now = Date.now();

    const totalCycleDays = Math.max(1, Math.round((periodEnd - periodStart) / (1000 * 3600 * 24)));
    const daysRemaining = Math.max(0, Math.ceil((periodEnd - now) / (1000 * 3600 * 24)));

    return calculateProration({
      currentTier: sub.plan_tier,
      currentSeats: sub.seat_count,
      newTier: newPlanTier,
      newSeats: newSeatCount,
      totalCycleDays,
      daysRemaining,
    });
  }

  /**
   * Transactionally executes plan/seat adjustments with proration and writes to immutable ledger.
   * Supports Idempotency-Key on every payment/adjustment request.
   */
  static async updateSubscription(
    businessId: string,
    actorUserId: string,
    input: { newPlanTier: PlanTier; newSeatCount: number; idempotencyKey?: string }
  ) {
    const { newPlanTier, newSeatCount, idempotencyKey } = input;
    const cleanKey = idempotencyKey?.trim() || null;

    // Check if this idempotency key was already processed
    if (cleanKey) {
      const existingLedger = await query(
        `SELECT id, amount_cents, description, metadata, created_at
         FROM billing_ledger
         WHERE business_id = $1 AND idempotency_key = $2`,
        [businessId, cleanKey]
      );
      if (existingLedger.rowCount && existingLedger.rowCount > 0) {
        // Return existing completed result
        const currentSub = await this.getSubscription(businessId);
        return {
          subscription: currentSub,
          proration: existingLedger.rows[0].metadata?.proration,
          ledgerEntry: existingLedger.rows[0],
          isReplay: true,
        };
      }
    }

    const proration = await this.previewProration(businessId, { newPlanTier, newSeatCount });
    const targetPlan = PLAN_CONFIG[newPlanTier];

    return await poolAdapter.withTransaction(async (client) => {
      const subRes = await client.query(
        `SELECT id, current_period_end, seat_count, plan_tier FROM subscriptions WHERE business_id = $1 FOR UPDATE`,
        [businessId]
      );
      if (subRes.rowCount === 0) {
        throw new Error('Subscription not found');
      }
      const sub = subRes.rows[0];

      let updatedSub: any;
      let ledgerEntry: any;

      if (!proration.isDowngrade) {
        // Immediate upgrade / seat addition
        const monthlyCostCents = calculateMonthlyPlanCostCents(newPlanTier, newSeatCount);
        const updateRes = await client.query(
          `UPDATE subscriptions
           SET plan_tier = $1,
               seat_count = $2,
               unit_price_cents = $3,
               status = 'ACTIVE',
               scheduled_plan_tier = NULL,
               scheduled_seat_count = NULL,
               scheduled_effective_at = NULL,
               updated_at = NOW()
           WHERE id = $4
           RETURNING *`,
          [newPlanTier, newSeatCount, monthlyCostCents, sub.id]
        );
        updatedSub = updateRes.rows[0];

        // Append CHARGE entry to immutable billing_ledger
        const chargeDesc = `Prorated upgrade to ${targetPlan.name} (${newSeatCount} seats): $${(
          proration.chargeTodayCents / 100
        ).toFixed(2)}`;

        const ledgerInsert = await client.query(
          `INSERT INTO billing_ledger
            (business_id, subscription_id, entry_type, amount_cents, currency, description, idempotency_key, metadata)
           VALUES ($1, $2, 'CHARGE', $3, 'USD', $4, $5, $6)
           RETURNING *`,
          [
            businessId,
            sub.id,
            proration.chargeTodayCents,
            chargeDesc,
            cleanKey,
            JSON.stringify({ proration, actorUserId }),
          ]
        );
        ledgerEntry = ledgerInsert.rows[0];

        // Also record unused credit entry if applicable for transparent ledger auditing
        if (proration.unusedCreditCents > 0) {
          await client.query(
            `INSERT INTO billing_ledger
              (business_id, subscription_id, entry_type, amount_cents, currency, description, metadata)
             VALUES ($1, $2, 'CREDIT', $3, 'USD', $4, $5)`,
            [
              businessId,
              sub.id,
              proration.unusedCreditCents,
              `Proration credit for unused ${sub.plan_tier} time`,
              JSON.stringify({ previousPlanTier: sub.plan_tier, actorUserId }),
            ]
          );
        }
      } else {
        // Scheduled downgrade / seat reduction at period end
        const updateRes = await client.query(
          `UPDATE subscriptions
           SET scheduled_plan_tier = $1,
               scheduled_seat_count = $2,
               scheduled_effective_at = current_period_end,
               updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [newPlanTier, newSeatCount, sub.id]
        );
        updatedSub = updateRes.rows[0];

        // Append informational CREDIT/SCHEDULE note to immutable ledger
        const ledgerInsert = await client.query(
          `INSERT INTO billing_ledger
            (business_id, subscription_id, entry_type, amount_cents, currency, description, idempotency_key, metadata)
           VALUES ($1, $2, 'CREDIT', 0, 'USD', $3, $4, $5)
           RETURNING *`,
          [
            businessId,
            sub.id,
            `Scheduled downgrade to ${targetPlan.name} (${newSeatCount} seats) effective at end of billing cycle (${sub.current_period_end})`,
            cleanKey,
            JSON.stringify({ proration, actorUserId, effectiveAt: sub.current_period_end }),
          ]
        );
        ledgerEntry = ledgerInsert.rows[0];
      }

      return {
        subscription: updatedSub,
        proration,
        ledgerEntry,
        isReplay: false,
      };
    });
  }

  /**
   * Rebuilds authoritative subscription state from the immutable billing ledger.
   * Proves that all charges, credits, and refunds form an audit-complete state.
   */
  static async rebuildSubscriptionStateFromLedger(businessId: string) {
    const ledgerRes = await query(
      `SELECT id, entry_type, amount_cents, currency, description, idempotency_key, provider_payment_id, created_at
       FROM billing_ledger
       WHERE business_id = $1
       ORDER BY created_at ASC`,
      [businessId]
    );

    let totalChargedCents = 0;
    let totalCreditedCents = 0;
    let totalRefundedCents = 0;

    for (const entry of ledgerRes.rows) {
      if (entry.entry_type === 'CHARGE') {
        totalChargedCents += entry.amount_cents;
      } else if (entry.entry_type === 'CREDIT') {
        totalCreditedCents += entry.amount_cents;
      } else if (entry.entry_type === 'REFUND') {
        totalRefundedCents += entry.amount_cents;
      }
    }

    const netPaidCents = totalChargedCents - totalRefundedCents;

    return {
      businessId,
      entryCount: ledgerRes.rowCount,
      totalChargedCents,
      totalCreditedCents,
      totalRefundedCents,
      netPaidCents,
      ledgerEntries: ledgerRes.rows,
    };
  }

  /**
   * Handles a failed subscription renewal:
   * 1. Transitions subscription to 7-day GRACE_PERIOD.
   * 2. Logs CORRECTION into billing_ledger.
   * 3. Dispatches asynchronous warning notification to the owner.
   */
  static async handleRenewalFailure(businessId: string, details: Record<string, unknown> = {}) {
    return await poolAdapter.withTransaction(async (client) => {
      const subRes = await client.query(
        `SELECT id, business_id FROM subscriptions WHERE business_id = $1 FOR UPDATE`,
        [businessId]
      );
      if (subRes.rowCount === 0) {
        throw new Error('Subscription not found');
      }
      const sub = subRes.rows[0];

      const gracePeriodDays = 7;
      await client.query(
        `UPDATE subscriptions
         SET status = 'GRACE_PERIOD',
             grace_period_ends_at = NOW() + INTERVAL '7 days',
             updated_at = NOW()
         WHERE id = $1`,
        [sub.id]
      );

      // Record failed renewal in ledger
      await client.query(
        `INSERT INTO billing_ledger
          (business_id, subscription_id, entry_type, amount_cents, currency, description, metadata)
         VALUES ($1, $2, 'CORRECTION', 0, 'USD', 'Subscription renewal failed. 7-day grace period initiated.', $3)`,
        [businessId, sub.id, JSON.stringify(details)]
      );

      // Find owner email and business name to send notification
      const ownerRes = await client.query(
        `SELECT u.email, b.name as business_name
         FROM businesses b
         JOIN teams t ON t.business_id = b.id
         JOIN team_memberships tm ON tm.team_id = t.id AND tm.role = 'OWNER'
         JOIN users u ON u.id = tm.user_id
         WHERE b.id = $1
         LIMIT 1`,
        [businessId]
      );

      if (ownerRes.rowCount && ownerRes.rowCount > 0) {
        const { email, business_name } = ownerRes.rows[0];
        try {
          await EmailService.sendBillingFailureNotification(email, business_name, gracePeriodDays);
        } catch (err: any) {
          console.error('Failed to enqueue billing failure email:', err.message);
        }
      }

      return {
        status: 'GRACE_PERIOD',
        gracePeriodDays,
      };
    });
  }

  /**
   * Processes a verified Flutterwave webhook payload in a background job.
   * Deduplicates by provider_event_id and writes payment outcome to ledger.
   */
  static async processVerifiedWebhook(payload: any, signature?: string) {
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || 'test-flutterwave-secret-hash';
    if (signature && signature !== secretHash) {
      const err: any = new Error('Invalid Flutterwave webhook signature');
      err.code = 'UNAUTHORIZED';
      err.status = 401;
      throw err;
    }

    const providerEventId = String(
      payload.id || payload.data?.id || payload.event_id || `flw_${Date.now()}`
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Deduplication check: ignore if provider event ID was already processed
      const existing = await client.query(
        `SELECT id FROM billing_ledger WHERE provider_event_id = $1`,
        [providerEventId]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        await client.query('COMMIT');
        return { status: 'already_processed', providerEventId };
      }

      const txStatus = payload.data?.status || payload.status;
      const customerEmail = payload.data?.customer?.email || payload.customer?.email;
      const amountCents = Math.round((payload.data?.amount || payload.amount || 0) * 100);

      let businessId: string | null = null;
      if (customerEmail) {
        const userRes = await client.query(
          `SELECT t.business_id
           FROM users u
           JOIN team_memberships tm ON tm.user_id = u.id AND tm.role = 'OWNER'
           JOIN teams t ON t.id = tm.team_id
           WHERE LOWER(u.email) = LOWER($1)
           LIMIT 1`,
          [customerEmail.trim()]
        );
        if (userRes.rowCount && userRes.rowCount > 0) {
          businessId = userRes.rows[0].business_id;
        }
      }

      if (businessId) {
        const subRes = await client.query(
          `SELECT id FROM subscriptions WHERE business_id = $1 FOR UPDATE`,
          [businessId]
        );

        if (subRes.rowCount && subRes.rowCount > 0) {
          const subId = subRes.rows[0].id;
          const isSuccess = txStatus === 'successful';

          if (isSuccess) {
            await client.query(
              `UPDATE subscriptions
               SET status = 'ACTIVE',
                   current_period_start = NOW(),
                   current_period_end = NOW() + INTERVAL '30 days',
                   grace_period_ends_at = NULL,
                   updated_at = NOW()
               WHERE id = $1`,
              [subId]
            );

            await client.query(
              `INSERT INTO billing_ledger
                (business_id, subscription_id, entry_type, amount_cents, currency, description, provider_event_id, metadata)
               VALUES ($1, $2, 'CHARGE', $3, 'USD', $4, $5, $6)`,
              [
                businessId,
                subId,
                amountCents,
                `Verified Flutterwave renewal payment: ${providerEventId}`,
                providerEventId,
                JSON.stringify(payload),
              ]
            );
          } else {
            // Payment failed: start grace period
            await client.query(
              `UPDATE subscriptions
               SET status = 'GRACE_PERIOD',
                   grace_period_ends_at = NOW() + INTERVAL '7 days',
                   updated_at = NOW()
               WHERE id = $1`,
              [subId]
            );

            await client.query(
              `INSERT INTO billing_ledger
                (business_id, subscription_id, entry_type, amount_cents, currency, description, provider_event_id, metadata)
               VALUES ($1, $2, 'CORRECTION', 0, 'USD', $3, $4, $5)`,
              [
                businessId,
                subId,
                `Flutterwave payment failed: ${providerEventId}. Entered 7-day grace period.`,
                providerEventId,
                JSON.stringify(payload),
              ]
            );
          }
        }
      }

      await client.query('COMMIT');
      return { status: 'processed', providerEventId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Asserts whether a business is currently authorized to perform scheduling actions.
   * Blocks mutations if subscription is in RESTRICTED mode.
   */
  static async assertCanSchedule(businessId: string): Promise<void> {
    const subRes = await query(
      `SELECT status, grace_period_ends_at FROM subscriptions WHERE business_id = $1`,
      [businessId]
    );
    if (subRes.rowCount && subRes.rowCount > 0) {
      const sub = subRes.rows[0];
      if (sub.status === 'RESTRICTED') {
        const err: any = new Error(
          'Your account access is restricted due to past due payments. Please update your payment method to manage shifts.'
        );
        err.code = 'SUBSCRIPTION_RESTRICTED';
        err.status = 402;
        throw err;
      }
      if (sub.status === 'GRACE_PERIOD' && sub.grace_period_ends_at) {
        if (Date.now() > new Date(sub.grace_period_ends_at).getTime()) {
          await query(
            `UPDATE subscriptions SET status = 'RESTRICTED', updated_at = NOW() WHERE business_id = $1`,
            [businessId]
          );
          const err: any = new Error(
            'Your 7-day grace period has expired. Account is in restricted mode. Please renew your subscription.'
          );
          err.code = 'SUBSCRIPTION_RESTRICTED';
          err.status = 402;
          throw err;
        }
      }
    }
  }
}
