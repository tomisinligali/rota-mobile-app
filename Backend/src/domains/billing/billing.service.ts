import { pool, query } from '../../db/pool';

export interface PlanDetails {
  tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  name: string;
  unitPriceCents: number; // In smallest currency unit (pence/cents)
  minSeats: number;
  currency: string;
  description: string;
}

export const PLAN_CONFIG: Record<string, PlanDetails> = {
  STARTER: {
    tier: 'STARTER',
    name: 'Starter Plan',
    unitPriceCents: 400, // £4.00 per staff seat/month
    minSeats: 1,
    currency: 'GBP',
    description: 'Core shift scheduling, direct swaps & activity feed for small teams',
  },
  GROWTH: {
    tier: 'GROWTH',
    name: 'Growth Plan',
    unitPriceCents: 700, // £7.00 per staff seat/month
    minSeats: 5,
    currency: 'GBP',
    description: 'Multi-location operations, open shift claim queue & manager inbox',
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Enterprise Plan',
    unitPriceCents: 1200, // £12.00 per staff seat/month
    minSeats: 10,
    currency: 'GBP',
    description: 'Full workforce coordination, custom seats, audit history & proration controls',
  },
};

export class BillingService {
  /**
   * Retrieves current subscription and active staff seat count for a business.
   */
  static async getSubscription(businessId: string) {
    const subRes = await query(
      `SELECT id, business_id, plan_tier, seat_count, status, unit_price_cents, currency,
              trial_starts_at, trial_ends_at, current_period_start, current_period_end,
              grace_period_ends_at, created_at, updated_at
       FROM subscriptions WHERE business_id = $1`,
      [businessId]
    );

    if (subRes.rowCount === 0) {
      // Auto-create initial 14-day starter trial if missing
      const initRes = await query(
        `INSERT INTO subscriptions (business_id, plan_tier, seat_count, status, unit_price_cents, currency)
         VALUES ($1, 'STARTER', 5, 'TRIALING', 400, 'GBP')
         RETURNING *`,
        [businessId]
      );
      return this.formatSubscriptionData(initRes.rows[0], businessId);
    }

    return this.formatSubscriptionData(subRes.rows[0], businessId);
  }

  private static async formatSubscriptionData(sub: any, businessId: string) {
    // Count active billable STAFF seats authoritatively
    const countRes = await query(
      `SELECT COUNT(DISTINCT tm.user_id) as active_staff
       FROM team_memberships tm
       JOIN teams t ON t.id = tm.team_id
       WHERE t.business_id = $1 AND tm.role = 'STAFF' AND tm.status = 'ACTIVE'`,
      [businessId]
    );

    const activeStaffCount = parseInt(countRes.rows[0]?.active_staff || '0', 10);
    const now = new Date();
    const trialEnd = new Date(sub.trial_ends_at);
    const trialDaysRemaining = Math.max(
      0,
      Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 3600 * 24))
    );

    const periodEnd = new Date(sub.current_period_end);
    const cycleDaysRemaining = Math.max(
      0,
      Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 3600 * 24))
    );

    // Fetch recent billing events
    const eventsRes = await query(
      `SELECT id, type, amount_cents, prorated_amount_cents, currency, description, details, created_at
       FROM billing_events
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [businessId]
    );

    return {
      id: sub.id,
      businessId: sub.business_id,
      planTier: sub.plan_tier,
      planDetails: PLAN_CONFIG[sub.plan_tier] || PLAN_CONFIG.STARTER,
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
      availablePlans: Object.values(PLAN_CONFIG),
      recentEvents: eventsRes.rows,
    };
  }

  /**
   * Previews midcycle proration for changing plan tier or seat count.
   * Calculations are strictly integer arithmetic in smallest currency unit.
   */
  static async previewProration(
    businessId: string,
    input: { newPlanTier: string; newSeatCount: number }
  ) {
    const { newPlanTier, newSeatCount } = input;
    const targetPlan = PLAN_CONFIG[newPlanTier];
    if (!targetPlan) {
      const err: any = new Error('Invalid plan tier specified');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    if (newSeatCount < targetPlan.minSeats) {
      const err: any = new Error(
        `The ${targetPlan.name} requires a minimum of ${targetPlan.minSeats} seats`
      );
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    // Active staff seats check - cannot reduce below active staff
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
      `SELECT plan_tier, seat_count, unit_price_cents, currency, current_period_start, current_period_end
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
    const now = Date.now();
    const periodStart = new Date(sub.current_period_start).getTime();
    const periodEnd = new Date(sub.current_period_end).getTime();

    const totalCycleMs = Math.max(1, periodEnd - periodStart);
    const remainingMs = Math.max(0, periodEnd - now);
    const remainingFraction = remainingMs / totalCycleMs;
    const remainingDays = Math.ceil(remainingMs / (1000 * 3600 * 24));

    // Integer math:
    const oldMonthlyTotalCents = sub.seat_count * sub.unit_price_cents;
    const newMonthlyTotalCents = newSeatCount * targetPlan.unitPriceCents;

    // Unused portion of current plan in this cycle
    const unusedCurrentPlanCents = Math.round(oldMonthlyTotalCents * remainingFraction);
    // Cost of new plan for the remainder of this cycle
    const costNewPlanRemainderCents = Math.round(newMonthlyTotalCents * remainingFraction);

    // Net prorated amount due today (can be positive for upgrade/add seats, or negative/zero for downgrade/credit)
    const proratedDeltaCents = costNewPlanRemainderCents - unusedCurrentPlanCents;

    return {
      currentPlanTier: sub.plan_tier,
      currentSeatCount: sub.seat_count,
      currentMonthlyTotalCents: oldMonthlyTotalCents,
      newPlanTier: targetPlan.tier,
      newSeatCount,
      newMonthlyTotalCents,
      remainingDays,
      proratedDeltaCents, // e.g. 1500 = £15.00 due immediately, -400 = £4.00 credit
      currency: sub.currency,
      action:
        proratedDeltaCents > 0
          ? 'UPGRADE_PAYMENT_DUE'
          : proratedDeltaCents < 0
          ? 'DOWNGRADE_CREDIT'
          : 'NO_CHARGE',
    };
  }

  /**
   * Transactionally executes midcycle upgrade/downgrade or seat change with proration.
   */
  static async updateSubscription(
    businessId: string,
    actorUserId: string,
    input: { newPlanTier: string; newSeatCount: number }
  ) {
    const proration = await this.previewProration(businessId, input);
    const targetPlan = PLAN_CONFIG[input.newPlanTier];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update subscription record
      const updateRes = await client.query(
        `UPDATE subscriptions
         SET plan_tier = $1,
             seat_count = $2,
             unit_price_cents = $3,
             status = 'ACTIVE',
             updated_at = NOW()
         WHERE business_id = $4
         RETURNING *`,
        [targetPlan.tier, input.newSeatCount, targetPlan.unitPriceCents, businessId]
      );

      const updatedSub = updateRes.rows[0];

      // Insert billing event / proration invoice
      const eventType =
        input.newPlanTier !== proration.currentPlanTier
          ? targetPlan.unitPriceCents > updatedSub.unit_price_cents
            ? 'PLAN_UPGRADED'
            : 'PLAN_DOWNGRADED'
          : input.newSeatCount > proration.currentSeatCount
          ? 'SEATS_ADDED'
          : 'SEATS_REMOVED';

      const description = `${targetPlan.name} update: ${input.newSeatCount} seats (proration: ${
        proration.proratedDeltaCents >= 0 ? '+' : ''
      }${(proration.proratedDeltaCents / 100).toFixed(2)} ${proration.currency})`;

      const eventRes = await client.query(
        `INSERT INTO billing_events 
          (business_id, subscription_id, type, amount_cents, prorated_amount_cents, currency, description, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          businessId,
          updatedSub.id,
          eventType,
          proration.newMonthlyTotalCents,
          proration.proratedDeltaCents,
          proration.currency,
          description,
          JSON.stringify({
            previousTier: proration.currentPlanTier,
            previousSeats: proration.currentSeatCount,
            newTier: targetPlan.tier,
            newSeats: input.newSeatCount,
            actorUserId,
          }),
        ]
      );

      // Add activity log for teams under this business
      const teamsRes = await client.query(
        `SELECT id FROM teams WHERE business_id = $1 LIMIT 1`,
        [businessId]
      );

      if (teamsRes.rowCount && teamsRes.rowCount > 0) {
        await client.query(
          `INSERT INTO activity_logs (team_id, actor_id, entity_type, entity_id, action, description, details)
           VALUES ($1, $2, 'BILLING', $3, 'SUBSCRIPTION_UPDATED', $4, $5)`,
          [
            teamsRes.rows[0].id,
            actorUserId,
            updatedSub.id,
            description,
            JSON.stringify(proration),
          ]
        );
      }

      await client.query('COMMIT');

      return {
        subscription: updatedSub,
        proration,
        billingEvent: eventRes.rows[0],
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Idempotently processes Flutterwave webhooks using provider_event_id deduplication.
   */
  static async handleFlutterwaveWebhook(payload: any, signature?: string) {
    // Secret hash verification
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
    if (secretHash && signature && signature !== secretHash) {
      const err: any = new Error('Invalid Flutterwave webhook signature');
      err.code = 'UNAUTHORIZED';
      err.status = 401;
      throw err;
    }

    const providerEventId = String(payload.id || payload.data?.id || `flw_${Date.now()}`);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if this provider event was already processed (at-least-once deduplication)
      const existing = await client.query(
        `SELECT id FROM billing_events WHERE provider_event_id = $1`,
        [providerEventId]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        // Already processed, return success idempotently
        await client.query('COMMIT');
        return { status: 'already_processed', providerEventId };
      }

      const txStatus = payload.data?.status || payload.status;
      const customerEmail = payload.data?.customer?.email;

      // Locate business by owner email if available
      let businessId: string | null = null;
      if (customerEmail) {
        const userRes = await client.query(
          `SELECT tm.team_id, t.business_id 
           FROM users u 
           JOIN team_memberships tm ON tm.user_id = u.id 
           JOIN teams t ON t.id = tm.team_id 
           WHERE u.email = $1 AND tm.role = 'OWNER' 
           LIMIT 1`,
          [customerEmail]
        );
        if (userRes.rowCount && userRes.rowCount > 0) {
          businessId = userRes.rows[0].business_id;
        }
      }

      if (businessId) {
        const subRes = await client.query(
          `SELECT id FROM subscriptions WHERE business_id = $1`,
          [businessId]
        );

        if (subRes.rowCount && subRes.rowCount > 0) {
          const subId = subRes.rows[0].id;
          const isSuccess = txStatus === 'successful';

          await client.query(
            `UPDATE subscriptions 
             SET status = $1,
                 current_period_start = NOW(),
                 current_period_end = NOW() + INTERVAL '30 days',
                 updated_at = NOW()
             WHERE id = $2`,
            [isSuccess ? 'ACTIVE' : 'GRACE_PERIOD', subId]
          );

          await client.query(
            `INSERT INTO billing_events 
              (business_id, subscription_id, type, amount_cents, currency, description, details, provider_event_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              businessId,
              subId,
              isSuccess ? 'PAYMENT_SUCCEEDED' : 'PAYMENT_FAILED',
              Math.round((payload.data?.amount || 0) * 100),
              payload.data?.currency || 'GBP',
              `Flutterwave payment ${txStatus}: ${payload.data?.tx_ref || providerEventId}`,
              JSON.stringify(payload),
              providerEventId,
            ]
          );
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
}
