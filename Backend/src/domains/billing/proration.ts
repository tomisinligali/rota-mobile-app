/**
 * Proration and Subscription Math Engine for Rota.
 * Implements deterministic integer-cents arithmetic with Math.floor rounding rules.
 * Does not depend on external payment provider calculators.
 */

export type PlanTier = 'STARTER' | 'TEAM' | 'BUSINESS';

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  basePriceCents: number; // Stored strictly in integer cents (e.g. 2000 = $20.00)
  includedSeats: number;
  extraSeatPriceCents: number | null; // null if extra seats are not supported
  currency: string;
}

export const PLAN_CONFIG: Record<PlanTier, PlanConfig> = {
  STARTER: {
    tier: 'STARTER',
    name: 'Starter',
    basePriceCents: 2000, // $20.00 / month
    includedSeats: 5,
    extraSeatPriceCents: null, // Extra seats not available
    currency: 'USD',
  },
  TEAM: {
    tier: 'TEAM',
    name: 'Team',
    basePriceCents: 5000, // $50.00 / month
    includedSeats: 15,
    extraSeatPriceCents: 300, // $3.00 / month per extra seat
    currency: 'USD',
  },
  BUSINESS: {
    tier: 'BUSINESS',
    name: 'Business',
    basePriceCents: 12000, // $120.00 / month
    includedSeats: 40,
    extraSeatPriceCents: 200, // $2.00 / month per extra seat
    currency: 'USD',
  },
};

/**
 * Calculates the monthly cost in cents for a given plan tier and seat count.
 * Enforces seat limits (Starter plan cannot have more than 5 seats).
 */
export function calculateMonthlyPlanCostCents(tier: PlanTier, seats: number): number {
  const plan = PLAN_CONFIG[tier];
  if (!plan) {
    throw new Error(`Invalid plan tier: ${tier}`);
  }

  if (seats <= 0) {
    throw new Error('Seat count must be at least 1');
  }

  if (tier === 'STARTER') {
    if (seats > plan.includedSeats) {
      const err: any = new Error(
        `The Starter plan includes up to ${plan.includedSeats} seats. Extra seats are not available. Please upgrade to Team.`
      );
      err.code = 'SEAT_LIMIT_EXCEEDED';
      err.status = 400;
      throw err;
    }
    return plan.basePriceCents;
  }

  if (seats <= plan.includedSeats) {
    return plan.basePriceCents;
  }

  const extraSeats = seats - plan.includedSeats;
  return plan.basePriceCents + extraSeats * (plan.extraSeatPriceCents || 0);
}

export interface ProrationResult {
  currentPlanTier: PlanTier;
  currentSeatCount: number;
  currentMonthlyCostCents: number;
  newPlanTier: PlanTier;
  newSeatCount: number;
  newMonthlyCostCents: number;
  totalCycleDays: number;
  daysRemaining: number;
  unusedCreditCents: number;
  newCostRemainingCents: number;
  chargeTodayCents: number;
  currency: string;
  isDowngrade: boolean;
  effectiveImmediately: boolean;
  explanation: string;
}

/**
 * Calculates mid-cycle proration for plan and seat adjustments.
 *
 * Formula:
 *   unusedCredit = Math.floor((oldPlanMonthlyCost * daysRemaining) / totalCycleDays)
 *   newCostRemaining = Math.floor((newPlanMonthlyCost * daysRemaining) / totalCycleDays)
 *
 * For Upgrades / Seat Additions:
 *   chargeToday = newCostRemaining - unusedCredit
 *   Takes effect immediately.
 *
 * For Downgrades / Seat Reductions:
 *   chargeToday = 0
 *   Takes effect at the end of the billing period to avoid partial refund risks.
 */
export function calculateProration(params: {
  currentTier: PlanTier;
  currentSeats: number;
  newTier: PlanTier;
  newSeats: number;
  totalCycleDays: number;
  daysRemaining: number;
}): ProrationResult {
  const { currentTier, currentSeats, newTier, newSeats, totalCycleDays, daysRemaining } = params;

  if (totalCycleDays <= 0) {
    throw new Error('Total cycle days must be greater than 0');
  }

  const clampedDaysRemaining = Math.max(0, Math.min(daysRemaining, totalCycleDays));

  const currentMonthlyCostCents = calculateMonthlyPlanCostCents(currentTier, currentSeats);
  const newMonthlyCostCents = calculateMonthlyPlanCostCents(newTier, newSeats);

  // Credit for unused time on current plan (rounded down integer cents)
  const unusedCreditCents = Math.floor(
    (currentMonthlyCostCents * clampedDaysRemaining) / totalCycleDays
  );

  // Cost of new plan for the remaining time in this cycle (rounded down integer cents)
  const newCostRemainingCents = Math.floor(
    (newMonthlyCostCents * clampedDaysRemaining) / totalCycleDays
  );

  const isCostIncrease = newMonthlyCostCents > currentMonthlyCostCents;

  if (isCostIncrease) {
    // Immediate upgrade / addition
    const chargeTodayCents = Math.max(0, newCostRemainingCents - unusedCreditCents);
    return {
      currentPlanTier: currentTier,
      currentSeatCount: currentSeats,
      currentMonthlyCostCents,
      newPlanTier: newTier,
      newSeatCount: newSeats,
      newMonthlyCostCents,
      totalCycleDays,
      daysRemaining: clampedDaysRemaining,
      unusedCreditCents,
      newCostRemainingCents,
      chargeTodayCents,
      currency: 'USD',
      isDowngrade: false,
      effectiveImmediately: true,
      explanation: `Upgrade from ${PLAN_CONFIG[currentTier].name} to ${PLAN_CONFIG[newTier].name}: credit $${(
        unusedCreditCents / 100
      ).toFixed(2)}, new plan remainder $${(newCostRemainingCents / 100).toFixed(
        2
      )}, immediate charge $${(chargeTodayCents / 100).toFixed(2)}.`,
    };
  }

  // Downgrade / seat reduction:
  // Refunding partial payments adds risk and chargeback liabilities;
  // downgrade takes effect at the end of the current billing cycle.
  return {
    currentPlanTier: currentTier,
    currentSeatCount: currentSeats,
    currentMonthlyCostCents,
    newPlanTier: newTier,
    newSeatCount: newSeats,
    newMonthlyCostCents,
    totalCycleDays,
    daysRemaining: clampedDaysRemaining,
    unusedCreditCents,
    newCostRemainingCents,
    chargeTodayCents: 0,
    currency: 'USD',
    isDowngrade: true,
    effectiveImmediately: false,
    explanation: `Downgrade scheduled for end of period. Retains current plan until period ends; renewal billed at $${(
      newMonthlyCostCents / 100
    ).toFixed(2)}/mo.`,
  };
}
