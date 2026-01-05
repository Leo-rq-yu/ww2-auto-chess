import { Player, BASE_INCOME, BattleResult } from '../types';

// =============================================
// Economy System
// =============================================

// Interest tiers: every 10 gold = +1 interest, max +5
export function calculateInterest(gold: number): number {
  return Math.min(5, Math.floor(gold / 10));
}

// Win/lose streak bonus
export function calculateStreakBonus(winStreak: number, loseStreak: number): number {
  const streak = Math.max(winStreak, loseStreak);
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  if (streak >= 2) return 1;
  return 0;
}

// Calculate total income for a round
// Calculate total income for a round (reduced to prevent gold inflation)
export function calculateRoundIncome(
  player: Player,
  battleResult: BattleResult | null,
  isWinner: boolean
): number {
  let income = BASE_INCOME; // BASE_INCOME = 5

  // Interest (max 5)
  income += calculateInterest(player.money);

  // Streak bonus (max 3)
  income += calculateStreakBonus(player.winStreak, player.loseStreak);

  // Win bonus - reduced from survivors to flat +1
  if (battleResult && isWinner) {
    income += 1;
    // Removed survivor bonus as it was too high
  }

  return income;
}

// Update player streaks after battle
export function updatePlayerStreaks(
  player: Player,
  isWinner: boolean,
  isDraw: boolean
): { winStreak: number; loseStreak: number } {
  if (isDraw) {
    return { winStreak: 0, loseStreak: 0 };
  }

  if (isWinner) {
    return {
      winStreak: player.winStreak + 1,
      loseStreak: 0,
    };
  } else {
    return {
      winStreak: 0,
      loseStreak: player.loseStreak + 1,
    };
  }
}

// Calculate damage dealt to loser
export function calculateDamageToLoser(battleResult: BattleResult): number {
  if (battleResult.isDraw) {
    return 5;  // Fixed draw damage
  }
  
  // Damage = sum of surviving units' attack
  return Math.max(1, battleResult.damageDealt);
}

// Sell piece for gold (units sell for cost - 1, minimum 1)
export function calculateSellPrice(unitCost: number, starLevel: number): number {
  // 1-star: cost - 1 (min 1)
  // 2-star: 3x cost - 1
  // 3-star: 9x cost - 1
  const multiplier = Math.pow(3, starLevel - 1);
  return Math.max(1, (unitCost * multiplier) - 1);
}

// Level up costs
export const LEVEL_UP_COSTS: Record<number, number> = {
  1: 4,
  2: 4,
  3: 8,
  4: 12,
  5: 20,
  6: 32,
  7: 48,
  8: 70,
  9: 100,
};

// XP needed for level up
export function getXpNeededForLevel(currentLevel: number): number {
  return LEVEL_UP_COSTS[currentLevel] || 100;
}

// Unit cap per level - DISABLED (set to 99 to allow unlimited deployment)
// User requested to remove unit deployment limit
export const UNIT_CAP_PER_LEVEL: Record<number, number> = {
  1: 99,
  2: 99,
  3: 99,
  4: 99,
  5: 99,
  6: 99,
  7: 99,
  8: 99,
  9: 99,
  10: 99,
};

export function getUnitCap(_level: number): number {
  return 99; // No limit
}

// Shop odds per level (probability of each cost tier)
// More balanced distribution to ensure variety even at low levels
export const SHOP_ODDS: Record<number, Record<number, number>> = {
  // Level: { cost1: %, cost2: %, cost3: % }
  1: { 1: 50, 2: 35, 3: 15 },  // More variety at level 1
  2: { 1: 45, 2: 35, 3: 20 },
  3: { 1: 40, 2: 35, 3: 25 },
  4: { 1: 35, 2: 35, 3: 30 },
  5: { 1: 30, 2: 35, 3: 35 },
  6: { 1: 25, 2: 35, 3: 40 },
  7: { 1: 20, 2: 30, 3: 50 },
  8: { 1: 15, 2: 25, 3: 60 },
  9: { 1: 10, 2: 20, 3: 70 },
};

export function getShopOdds(level: number): Record<number, number> {
  return SHOP_ODDS[Math.min(level, 9)] || SHOP_ODDS[9];
}

