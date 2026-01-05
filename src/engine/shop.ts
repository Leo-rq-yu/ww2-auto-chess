import { UnitType, UNIT_DEFINITIONS } from '../types/units'
import { getShopOdds } from './economy'

export interface ShopCard {
  unitType: UnitType
  cost: number
}

const ALL_UNIT_TYPES: UnitType[] = [
  'infantry',
  'engineer',
  'armored_car',
  'tank',
  'artillery',
  'anti_air',
  'aircraft',
]

export function generateShopCards(level: number, count: number = 5): ShopCard[] {
  const odds = getShopOdds(level)
  const cards: ShopCard[] = []

  for (let i = 0; i < count; i++) {
    const roll = Math.random() * 100
    let costTier = '1'
    
    if (roll < odds['1']) {
      costTier = '1'
    } else if (roll < odds['1'] + odds['2']) {
      costTier = '2'
    } else {
      costTier = '3'
    }

    // Select unit by cost tier
    const availableUnits = ALL_UNIT_TYPES.filter(
      type => UNIT_DEFINITIONS[type].cost === parseInt(costTier)
    )

    if (availableUnits.length === 0) {
      // If no unit with matching cost, use cost 1 units
      const fallbackUnits = ALL_UNIT_TYPES.filter(
        type => UNIT_DEFINITIONS[type].cost === 1
      )
      const unitType = fallbackUnits[Math.floor(Math.random() * fallbackUnits.length)]
      cards.push({
        unitType,
        cost: UNIT_DEFINITIONS[unitType].cost,
      })
    } else {
      const unitType = availableUnits[Math.floor(Math.random() * availableUnits.length)]
      cards.push({
        unitType,
        cost: UNIT_DEFINITIONS[unitType].cost,
      })
    }
  }

  return cards
}
