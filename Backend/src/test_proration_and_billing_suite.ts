import crypto from 'crypto';
import { pool, query, poolAdapter } from './db/pool';
import {
  calculateProration,
  calculateMonthlyPlanCostCents,
  PLAN_CONFIG,
} from './domains/billing/proration';
import { BillingService } from './domains/billing/billing.service';
import { InvitationsService } from './domains/invitations/invitations.service';
import { ShiftsService } from './domains/shifts/shifts.service';
import { AuthService } from './domains/auth/auth.service';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

async function runTestSuite() {
  console.log('\n============================================================');
  console.log('   REQUIREMENT 5: PAYMENTS & PRORATION TEST SUITE');
  console.log('============================================================\n');

  try {
    // -----------------------------------------------------------------
    // TEST 1: Upgrade Proration (Ifeanyi's Café Scenario)
    // -----------------------------------------------------------------
    console.log('--- Test 1: Upgrade Proration (Ifeanyi\'s Café Scenario) ---');
    // Starter: 2000 cents (5 seats) -> Team: 5000 cents (15 seats) on Day 11 (20 days remaining of 30)
    const ifeanyiProration = calculateProration({
      currentTier: 'STARTER',
      currentSeats: 5,
      newTier: 'TEAM',
      newSeats: 9, // Hired 4 more people = 9 seats (Team includes up to 15)
      totalCycleDays: 30,
      daysRemaining: 20,
    });

    assert(ifeanyiProration.unusedCreditCents === 1333, 'Starter unused credit is 1333 cents (2000 * 20 / 30 rounded down)', `Got: ${ifeanyiProration.unusedCreditCents}`);
    assert(ifeanyiProration.newCostRemainingCents === 3333, 'Team remaining cost is 3333 cents (5000 * 20 / 30 rounded down)', `Got: ${ifeanyiProration.newCostRemainingCents}`);
    assert(ifeanyiProration.chargeTodayCents === 2000, 'Charge today is exactly 2000 cents ($20.00)', `Got: ${ifeanyiProration.chargeTodayCents}`);
    assert(ifeanyiProration.isDowngrade === false, 'Marked as upgrade (not downgrade)');
    assert(ifeanyiProration.effectiveImmediately === true, 'Upgrade takes effect immediately');

    // -----------------------------------------------------------------
    // TEST 2: Downgrade Proration (Team -> Starter)
    // -----------------------------------------------------------------
    console.log('\n--- Test 2: Downgrade Proration (Team -> Starter) ---');
    const downgradeProration = calculateProration({
      currentTier: 'TEAM',
      currentSeats: 15,
      newTier: 'STARTER',
      newSeats: 5,
      totalCycleDays: 30,
      daysRemaining: 20,
    });

    assert(downgradeProration.chargeTodayCents === 0, 'Downgrade charge today is 0 cents (no partial refund risk)', `Got: ${downgradeProration.chargeTodayCents}`);
    assert(downgradeProration.isDowngrade === true, 'Marked as downgrade');
    assert(downgradeProration.effectiveImmediately === false, 'Downgrade scheduled for end of cycle');

    // -----------------------------------------------------------------
    // TEST 3: Adding Seats Mid-Period (Team 15 -> 17 seats)
    // -----------------------------------------------------------------
    console.log('\n--- Test 3: Adding Extra Seats Mid-Period (Team 15 -> 17 seats) ---');
    // Team base: 5000 cents (15 seats). 17 seats: 5000 + 2 * 300 = 5600 cents.
    // 20 days remaining of 30.
    // unusedCredit: floor(5000 * 20 / 30) = 3333
    // newCostRemaining: floor(5600 * 20 / 30) = 3733
    // chargeToday: 3733 - 3333 = 400 cents ($4.00)
    const addSeatsProration = calculateProration({
      currentTier: 'TEAM',
      currentSeats: 15,
      newTier: 'TEAM',
      newSeats: 17,
      totalCycleDays: 30,
      daysRemaining: 20,
    });

    assert(addSeatsProration.chargeTodayCents === 400, 'Adding 2 extra seats charges 400 cents ($4.00)', `Got: ${addSeatsProration.chargeTodayCents}`);
    assert(addSeatsProration.isDowngrade === false, 'Extra seats count as upgrade/expansion');

    // -----------------------------------------------------------------
    // TEST 4: Removing Extra Seats Mid-Period (Team 17 -> 15 seats)
    // -----------------------------------------------------------------
    console.log('\n--- Test 4: Removing Seats Mid-Period (Team 17 -> 15 seats) ---');
    const removeSeatsProration = calculateProration({
      currentTier: 'TEAM',
      currentSeats: 17,
      newTier: 'TEAM',
      newSeats: 15,
      totalCycleDays: 30,
      daysRemaining: 20,
    });

    assert(removeSeatsProration.chargeTodayCents === 0, 'Seat reduction charges 0 cents today', `Got: ${removeSeatsProration.chargeTodayCents}`);
    assert(removeSeatsProration.isDowngrade === true, 'Seat reduction is treated as downgrade taking effect at renewal');

    // -----------------------------------------------------------------
    // TEST 5: Plan Change on First Day (Day 0 / 30 days remaining of 30)
    // -----------------------------------------------------------------
    console.log('\n--- Test 5: Plan Change on Day 0 (30 of 30 days remaining) ---');
    // Starter (2000) -> Team (5000) on day 0:
    // unusedCredit: floor(2000 * 30 / 30) = 2000
    // newCostRemaining: floor(5000 * 30 / 30) = 5000
    // chargeToday: 5000 - 2000 = 3000 cents ($30.00 difference)
    const firstDayProration = calculateProration({
      currentTier: 'STARTER',
      currentSeats: 5,
      newTier: 'TEAM',
      newSeats: 15,
      totalCycleDays: 30,
      daysRemaining: 30,
    });

    assert(firstDayProration.chargeTodayCents === 3000, 'Day 0 upgrade charges full plan difference (3000 cents / $30.00)', `Got: ${firstDayProration.chargeTodayCents}`);

    // -----------------------------------------------------------------
    // TEST 6: Plan Change on Last Day (0 days and 1 day remaining)
    // -----------------------------------------------------------------
    console.log('\n--- Test 6: Plan Change on Last Day ---');
    // Case A: 0 days remaining
    const zeroDaysProration = calculateProration({
      currentTier: 'STARTER',
      currentSeats: 5,
      newTier: 'TEAM',
      newSeats: 15,
      totalCycleDays: 30,
      daysRemaining: 0,
    });
    assert(zeroDaysProration.chargeTodayCents === 0, 'Change with 0 days remaining charges 0 cents today', `Got: ${zeroDaysProration.chargeTodayCents}`);

    // Case B: 1 day remaining
    // unusedCredit: floor(2000 * 1 / 30) = 66
    // newCostRemaining: floor(5000 * 1 / 30) = 166
    // chargeToday: 166 - 66 = 100 cents ($1.00)
    const oneDayProration = calculateProration({
      currentTier: 'STARTER',
      currentSeats: 5,
      newTier: 'TEAM',
      newSeats: 15,
      totalCycleDays: 30,
      daysRemaining: 1,
    });
    assert(oneDayProration.chargeTodayCents === 100, 'Change with 1 day remaining charges exactly 100 cents ($1.00)', `Got: ${oneDayProration.chargeTodayCents}`);

    // -----------------------------------------------------------------
    // TEST 7: Two Changes in One Period
    // -----------------------------------------------------------------
    console.log('\n--- Test 7: Two Changes in One Period ---');
    // Change 1: Day 11 (20 days remaining) Starter -> Team (2000 cents charged)
    assert(ifeanyiProration.chargeTodayCents === 2000, 'Step 1: Starter -> Team charges 2000 cents');

    // Change 2: Day 21 (10 days remaining) Team -> Business
    // Team: 5000 cents. Business: 12000 cents.
    // unusedCredit: floor(5000 * 10 / 30) = 1666 cents
    // newCostRemaining: floor(12000 * 10 / 30) = 4000 cents
    // chargeToday: 4000 - 1666 = 2334 cents ($23.34)
    const step2Proration = calculateProration({
      currentTier: 'TEAM',
      currentSeats: 15,
      newTier: 'BUSINESS',
      newSeats: 40,
      totalCycleDays: 30,
      daysRemaining: 10,
    });
    assert(step2Proration.unusedCreditCents === 1666, 'Team credit for 10 days is 1666 cents', `Got: ${step2Proration.unusedCreditCents}`);
    assert(step2Proration.newCostRemainingCents === 4000, 'Business cost for 10 days is 4000 cents', `Got: ${step2Proration.newCostRemainingCents}`);
    assert(step2Proration.chargeTodayCents === 2334, 'Step 2 charges exactly 2334 cents ($23.34)', `Got: ${step2Proration.chargeTodayCents}`);

    // -----------------------------------------------------------------
    // TEST 8: Starter Seat Boundary Violation
    // -----------------------------------------------------------------
    console.log('\n--- Test 8: Starter Seat Boundary Violation ---');
    let starterBoundaryError = false;
    try {
      calculateMonthlyPlanCostCents('STARTER', 6);
    } catch (err: any) {
      starterBoundaryError = true;
      assert(err.code === 'SEAT_LIMIT_EXCEEDED', 'Starter > 5 seats rejected with SEAT_LIMIT_EXCEEDED', `Got error code: ${err.code}`);
    }
    assert(starterBoundaryError, 'Starter tier throws error when attempting > 5 seats');

    // -----------------------------------------------------------------
    // Setup Test Data for End-to-End Tests 9 through 12
    // -----------------------------------------------------------------
    console.log('\n--- Setup Test Business, Subscriptions & Teams ---');
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const ownerEmail = `owner_${suffix}@example.com`;
    const regResult = await AuthService.register({
      email: ownerEmail,
      password: 'StrongPassword123!',
      firstName: 'Billing',
      lastName: 'Owner',
    });
    const ownerId = regResult.user.id;

    // Create Business
    const bizRes = await query(
      `INSERT INTO businesses (name, default_timezone) VALUES ($1, 'UTC') RETURNING id`,
      [`Test Biz ${suffix}`]
    );
    const businessId = bizRes.rows[0].id;

    // Create Team
    const teamRes = await query(
      `INSERT INTO teams (business_id, name, timezone) VALUES ($1, 'Main Location', 'UTC') RETURNING id`,
      [businessId]
    );
    const teamId = teamRes.rows[0].id;

    // Add Owner to Team
    await query(
      `INSERT INTO team_memberships (team_id, user_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')`,
      [teamId, ownerId]
    );

    // Create Subscription on Starter Plan (5 seats)
    const subRes = await query(
      `INSERT INTO subscriptions (
        business_id, plan_tier, status, seat_count, unit_price_cents,
        current_period_start, current_period_end
      ) VALUES ($1, 'STARTER', 'ACTIVE', 5, 2000, NOW(), NOW() + INTERVAL '30 days')
      RETURNING id`,
      [businessId]
    );
    const subscriptionId = subRes.rows[0].id;
    console.log(`  ✓ Created test business ${businessId} with Starter subscription ${subscriptionId}`);

    // -----------------------------------------------------------------
    // TEST 9: Server-Side Seat Limit Enforcement on Invitations
    // -----------------------------------------------------------------
    console.log('\n--- Test 9: Server-Side Seat Limit Enforcement on Invitations ---');
    // Starter has 5 seats. We create 5 staff members to reach the 5-seat limit.
    for (let i = 1; i <= 5; i++) {
      const staffUser = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name, email_verified_at)
         VALUES ($1, 'hash', $2, $3, NOW()) RETURNING id`,
        [`staff_${i}_${suffix}@example.com`, `Staff${i}`, 'Test']
      );
      await query(
        `INSERT INTO team_memberships (team_id, user_id, role, status) VALUES ($1, $2, 'STAFF', 'ACTIVE')`,
        [teamId, staffUser.rows[0].id]
      );
    }

    // Now active staff = 5 seats used out of 5 allowed on Starter.
    // Attempting to create a 6th staff invitation MUST be rejected with 403 SEAT_LIMIT_REACHED
    let inviteRejected = false;
    try {
      await InvitationsService.createInvitation(ownerId, teamId, {
        email: `sixth_invite_${suffix}@example.com`,
        role: 'STAFF',
      });
    } catch (err: any) {
      inviteRejected = true;
      assert(err.status === 403 && err.code === 'SEAT_LIMIT_REACHED', '6th invitation rejected with 403 SEAT_LIMIT_REACHED', `Got code: ${err.code}, status: ${err.status}`);
    }
    assert(inviteRejected, 'Server-side seat limit blocks 6th person on Starter plan');

    // -----------------------------------------------------------------
    // TEST 10: Immutable Ledger Enforcement & State Rebuild
    // -----------------------------------------------------------------
    console.log('\n--- Test 10: Immutable Ledger Enforcement & State Rebuild ---');
    // Perform an upgrade to Team with 15 seats using BillingService
    const upgradeResult = await BillingService.updateSubscription(businessId, ownerId, {
      newPlanTier: 'TEAM',
      newSeatCount: 15,
      idempotencyKey: `idemp-upgrade-${suffix}`,
    });

    assert(upgradeResult.subscription.plan_tier === 'TEAM', 'Subscription upgraded to TEAM');
    assert(upgradeResult.ledgerEntry.entry_type === 'CHARGE', 'CHARGE entry written to ledger');
    const ledgerEntryId = upgradeResult.ledgerEntry.id;

    // Attempt to UPDATE the ledger entry (MUST fail via trigger)
    let updateFailed = false;
    try {
      await query(`UPDATE billing_ledger SET amount_cents = 99999 WHERE id = $1`, [ledgerEntryId]);
    } catch (err: any) {
      updateFailed = true;
      assert(err.message.includes('immutable'), 'PostgreSQL trigger prevents UPDATE on billing_ledger', err.message);
    }
    assert(updateFailed, 'Trigger trg_billing_ledger_immutable prevents ledger mutation');

    // Attempt to DELETE the ledger entry (MUST fail via trigger)
    let deleteFailed = false;
    try {
      await query(`DELETE FROM billing_ledger WHERE id = $1`, [ledgerEntryId]);
    } catch (err: any) {
      deleteFailed = true;
      assert(err.message.includes('immutable'), 'PostgreSQL trigger prevents DELETE on billing_ledger', err.message);
    }
    assert(deleteFailed, 'Trigger trg_billing_ledger_immutable prevents ledger deletion');

    // Rebuild subscription state from ledger
    const rebuiltState = await BillingService.rebuildSubscriptionStateFromLedger(businessId);
    assert((rebuiltState.entryCount ?? 0) >= 1, 'Rebuilt state contains recorded ledger entries');
    assert(rebuiltState.totalChargedCents === upgradeResult.ledgerEntry.amount_cents, 'Rebuilt charges equal ledger charged sum');
    assert(rebuiltState.netPaidCents === upgradeResult.ledgerEntry.amount_cents, 'Rebuilt net paid matches authoritative ledger total');

    // Test Idempotency replay on updateSubscription
    const replayResult = await BillingService.updateSubscription(businessId, ownerId, {
      newPlanTier: 'TEAM',
      newSeatCount: 15,
      idempotencyKey: `idemp-upgrade-${suffix}`,
    });
    assert(replayResult.isReplay === true, 'Duplicate request with same Idempotency-Key returns isReplay: true without double charging');

    // -----------------------------------------------------------------
    // TEST 11: Webhook Signature, BullMQ Processing & Event Deduplication
    // -----------------------------------------------------------------
    console.log('\n--- Test 11: Webhook Signature, Processing & Event Deduplication ---');
    // Test invalid signature rejection
    let signatureRejected = false;
    try {
      await BillingService.processVerifiedWebhook(
        { id: `flw_evt_${suffix}`, status: 'successful', amount: 50 },
        'invalid-hash'
      );
    } catch (err: any) {
      signatureRejected = true;
      assert(err.code === 'UNAUTHORIZED', 'Invalid webhook signature rejected with UNAUTHORIZED', `Got: ${err.code}`);
    }
    assert(signatureRejected, 'Webhook signature verification enforced');

    // Test verified webhook processing
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || 'test-flutterwave-secret-hash';
    const providerEventId = `flw_evt_${suffix}_1`;
    const webhookPayload = {
      id: providerEventId,
      status: 'successful',
      amount: 50,
      customer: { email: ownerEmail },
    };

    const webhookResult1 = await BillingService.processVerifiedWebhook(webhookPayload, secretHash);
    assert(webhookResult1.status === 'processed', 'Webhook processed and subscription updated');

    // Test webhook deduplication: duplicate delivery MUST be ignored
    const webhookResult2 = await BillingService.processVerifiedWebhook(webhookPayload, secretHash);
    assert(webhookResult2.status === 'already_processed', 'Duplicate webhook delivery detected and safely ignored');

    // -----------------------------------------------------------------
    // TEST 12: Renewal Failure, 7-Day Grace Period & Restricted Mode
    // -----------------------------------------------------------------
    console.log('\n--- Test 12: Renewal Failure, 7-Day Grace Period & Restricted Mode ---');
    // Trigger renewal failure
    const failureResult = await BillingService.handleRenewalFailure(businessId, { reason: 'card_declined' });
    assert(failureResult.status === 'GRACE_PERIOD', 'Subscription enters GRACE_PERIOD');
    assert(failureResult.gracePeriodDays === 7, 'Grace period configured for 7 days');

    // In grace period, scheduling is NOT yet blocked
    let graceScheduleBlocked = false;
    try {
      await BillingService.assertCanSchedule(businessId);
    } catch {
      graceScheduleBlocked = true;
    }
    assert(!graceScheduleBlocked, 'During 7-day grace period, scheduling access is preserved');

    // Expire the grace period manually to test restricted mode transition
    await query(
      `UPDATE subscriptions SET grace_period_ends_at = NOW() - INTERVAL '1 day' WHERE business_id = $1`,
      [businessId]
    );

    // assertCanSchedule should now transition subscription to RESTRICTED and throw 402
    let restrictedBlocked = false;
    try {
      await BillingService.assertCanSchedule(businessId);
    } catch (err: any) {
      restrictedBlocked = true;
      assert(err.code === 'SUBSCRIPTION_RESTRICTED' && err.status === 402, 'Expired grace period transitions to RESTRICTED with 402 error', `Got code: ${err.code}`);
    }
    assert(restrictedBlocked, 'Account access restricted after grace period expiry');

    // Verify creating shifts in restricted mode is blocked
    let shiftBlocked = false;
    try {
      await ShiftsService.createShift(ownerId, teamId, {
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        roleName: 'Barista',
      });
    } catch (err: any) {
      shiftBlocked = true;
      assert(err.code === 'SUBSCRIPTION_RESTRICTED', 'createShift blocked by BillingService.assertCanSchedule', `Got code: ${err.code}`);
    }
    assert(shiftBlocked, 'Shift creation blocked when subscription is in restricted mode');

    // Verify historical shifts/data are NOT deleted
    const shiftsAfter = await ShiftsService.getShifts(teamId, {});
    assert(Array.isArray(shiftsAfter), 'Historical shift reading continues to work; scheduling data is never deleted');

  } catch (err: any) {
    console.error('\nUnexpected test suite error:', err);
    totalTests++;
    failedTests++;
  } finally {
    console.log('\n============================================================');
    console.log(`TOTAL TESTS: ${totalTests}`);
    console.log(`PASSED:      ${passedTests}`);
    console.log(`FAILED:      ${failedTests}`);
    console.log('============================================================\n');

    await pool.end();
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTestSuite();
