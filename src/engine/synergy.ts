import { Unit, UnitType, SynergyType, UNIT_TO_SYNERGY, SYNERGIES } from '../types/units'

export interface ActiveSynergy {
  type: SynergyType
  level: number
}

export function calculateSynergies(pieces: Unit[]): ActiveSynergy[] {
  const synergyCounts: Record<SynergyType, number> = {
    infantry: 0,
    engineering: 0,
    armor: 0,
    artillery: 0,
    air_force: 0,
  }

  // Only count units on board (with x, y coordinates)
  const boardPieces = pieces.filter(p => p.x !== undefined && p.y !== undefined)

  boardPieces.forEach(piece => {
    const synergies = UNIT_TO_SYNERGY[piece.type as UnitType]
    synergies.forEach(synergy => {
      synergyCounts[synergy]++
    })
  })

  const active: ActiveSynergy[] = []

  Object.entries(synergyCounts).forEach(([type, count]) => {
    const synergy = SYNERGIES[type as SynergyType]
    if (synergy) {
      const maxLevel = synergy.thresholds.filter(t => count >= t).length
      if (maxLevel > 0) {
        active.push({
          type: type as SynergyType,
          level: maxLevel,
        })
      }
    }
  })

  return active
}

export function applySynergyEffects(
  unit: Unit,
  synergies: ActiveSynergy[]
): Unit {
  const modified = { ...unit }

  synergies.forEach(synergy => {
    switch (synergy.type) {
      case 'infantry':
        if (unit.type === 'infantry') {
          modified.armor += 1
        }
        break
      case 'armor':
        if (unit.type === 'armored_car' || unit.type === 'tank') {
          modified.speed += 1
        }
        break
      case 'artillery':
        if (unit.type === 'artillery') {
          modified.attack[0] += 1
          modified.attack[1] += 1
        }
        break
      // air_force and engineering effects handled in battle logic
    }
  })

  return modified
}
