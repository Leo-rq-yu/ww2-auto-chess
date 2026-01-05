import { Unit, UnitType, UNIT_DEFINITIONS, TraitType, TRAITS } from '../types/units'

export function canMerge(units: Unit[]): boolean {
  if (units.length !== 3) return false
  
  const firstType = units[0].type
  const firstStar = units[0].starLevel
  
  return units.every(u => u.type === firstType && u.starLevel === firstStar)
}

export function mergeUnits(units: Unit[]): Unit {
  if (!canMerge(units)) {
    throw new Error('Cannot merge these units')
  }

  const baseUnit = units[0]
  const definition = UNIT_DEFINITIONS[baseUnit.type]
  const newStarLevel = Math.min(baseUnit.starLevel + 1, 3)

  // Calculate new stats (50-100% per star)
  const starMultiplier = 1 + (newStarLevel - 1) * 0.75
  
  const newHp = Math.floor(definition.baseHp * starMultiplier)
  const newAttackMin = Math.floor(definition.baseAttack[0] * starMultiplier)
  const newAttackMax = Math.floor(definition.baseAttack[1] * starMultiplier)
  const newArmor = Math.floor(definition.baseArmor * starMultiplier)

  // Collect all traits (up to star level)
  const allTraits = new Set<TraitType>()
  units.forEach(u => {
    u.traits.forEach(t => allTraits.add(t))
  })

  const traits = Array.from(allTraits).slice(0, newStarLevel)

  return {
    id: `unit_${Date.now()}_${Math.random()}`,
    type: baseUnit.type,
    starLevel: newStarLevel,
    hp: newHp,
    maxHp: newHp,
    attack: [newAttackMin, newAttackMax],
    armor: newArmor,
    attackType: definition.attackType,
    range: definition.range,
    speed: definition.speed,
    traits,
  }
}

export function generateRandomTrait(unitType: UnitType): TraitType | null {
  // 50% chance to get trait
  if (Math.random() > 0.5) return null

  // Filter invalid traits by unit type
  const invalidTraits: TraitType[] = []
  
  if (unitType === 'engineer') {
    // Engineers cannot get attack-related traits
    invalidTraits.push('armor_piercing', 'blitz', 'heavy_cannon', 'sniper')
  }

  const validTraits = Object.keys(TRAITS).filter(
    t => !invalidTraits.includes(t as TraitType)
  ) as TraitType[]

  if (validTraits.length === 0) return null

  return validTraits[Math.floor(Math.random() * validTraits.length)]
}
