export interface EconomyResult {
  baseIncome: number
  interest: number
  streakBonus: number
  winBonus: number
  total: number
}

export function calculateIncome(
  savedGold: number,
  winStreak: number,
  loseStreak: number,
  won: boolean
): EconomyResult {
  const baseIncome = 5
  const interest = Math.min(Math.floor(savedGold / 10), 5)
  
  let streakBonus = 0
  if (winStreak >= 5) {
    streakBonus = 3
  } else if (winStreak >= 3) {
    streakBonus = 2
  } else if (loseStreak >= 5) {
    streakBonus = 3
  } else if (loseStreak >= 3) {
    streakBonus = 2
  }

  const winBonus = won ? 1 : 0
  const total = baseIncome + interest + streakBonus + winBonus

  return {
    baseIncome,
    interest,
    streakBonus,
    winBonus,
    total,
  }
}

export function getShopOdds(level: number): Record<string, number> {
  // Return shop odds by player level
  // Using simplified probability table
  const odds: Record<number, Record<string, number>> = {
    1: { '1': 100, '2': 0, '3': 0 },
    2: { '1': 100, '2': 0, '3': 0 },
    3: { '1': 75, '2': 25, '3': 0 },
    4: { '1': 55, '2': 35, '3': 10 },
    5: { '1': 45, '2': 35, '3': 20 },
    6: { '1': 30, '2': 40, '3': 30 },
    7: { '1': 19, '2': 35, '3': 35 },
    8: { '1': 18, '2': 25, '3': 32 },
    9: { '1': 10, '2': 15, '3': 25 },
    10: { '1': 5, '2': 10, '3': 15 },
  }

  return odds[Math.min(level, 10)] || odds[10]
}
