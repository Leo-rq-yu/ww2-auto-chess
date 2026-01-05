import { UnitDefinition, Synergy } from './index';

// =============================================
// WW2 Auto-Chess Unit Definitions
// Based on the game design document
// =============================================

export const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  infantry: {
    typeId: 'infantry',
    name: 'Infantry',
    cost: 1,
    baseHp: 2,
    baseAttackMin: 1,
    baseAttackMax: 2,
    baseDefense: 0,
    baseSpeed: 2,
    baseRange: 1,
    attackType: 'melee',
    isAirUnit: false,
    traits: ['infantry'],
    description: 'Basic melee unit, high HP',
    imageUrl: '/images/infantry.webp',
  },
  engineer: {
    typeId: 'engineer',
    name: 'Engineer',
    cost: 1,
    baseHp: 2,
    baseAttackMin: 0,
    baseAttackMax: 0,
    baseDefense: 0,
    baseSpeed: 2,
    baseRange: 1,
    attackType: 'melee',
    isAirUnit: false,
    traits: ['engineer'],
    description: 'Cannot attack, provides fortification to allies',
    imageUrl: '/images/engineer.webp',
  },
  armored_car: {
    typeId: 'armored_car',
    name: 'Armored Car',
    cost: 2,
    baseHp: 4,
    baseAttackMin: 2,
    baseAttackMax: 3,
    baseDefense: 1,
    baseSpeed: 3,
    baseRange: 1,
    attackType: 'melee',
    isAirUnit: false,
    traits: ['armor'],
    description: 'High mobility, bonus vs infantry, countered by tanks',
    imageUrl: '/images/armored-cars.webp',
  },
  tank: {
    typeId: 'tank',
    name: 'Tank',
    cost: 3,
    baseHp: 6,
    baseAttackMin: 3,
    baseAttackMax: 4,
    baseDefense: 2,
    baseSpeed: 1,
    baseRange: 1,
    attackType: 'melee',
    isAirUnit: false,
    traits: ['armor'],
    description: 'Heavy unit, high HP and attack, bonus vs armored cars',
    imageUrl: '/images/tank.webp',
  },
  artillery: {
    typeId: 'artillery',
    name: 'Artillery',
    cost: 3,
    baseHp: 3,
    baseAttackMin: 3,
    baseAttackMax: 4,
    baseDefense: 0,
    baseSpeed: 0,  // Cannot move (can be 0-1 based on rules)
    baseRange: 3,
    attackType: 'aoe_radius',
    isAirUnit: false,
    traits: ['artillery'],
    description: 'Ranged AOE, weak in melee, cannot target aircraft',
    imageUrl: '/images/artillery.webp',
  },
  anti_air: {
    typeId: 'anti_air',
    name: 'Anti-Air',
    cost: 2,
    baseHp: 3,
    baseAttackMin: 2,
    baseAttackMax: 3,
    baseDefense: 0,
    baseSpeed: 1,
    baseRange: 3,
    attackType: 'aoe_radius',
    isAirUnit: false,
    traits: ['artillery'],
    description: '4-5 damage vs aircraft, half damage vs heavy armor',
    imageUrl: '/images/anti-air.webp',
  },
  aircraft: {
    typeId: 'aircraft',
    name: 'Aircraft',
    cost: 3,
    baseHp: 4,
    baseAttackMin: 2,
    baseAttackMax: 3,
    baseDefense: 0,
    baseSpeed: 2,
    baseRange: 2,
    attackType: 'line_sweep',
    isAirUnit: true,
    traits: ['air'],
    description: 'Air unit, ignores fortifications, artillery cannot counter',
    imageUrl: '/images/aircraft.webp',
  },
};

// =============================================
// Synergy Definitions
// =============================================

export const SYNERGY_DEFINITIONS: Synergy[] = [
  {
    synergyId: 'infantry_synergy',
    name: 'Infantry',
    traitType: 'infantry',
    triggerCount: 3,
    effect: { stat: 'defense', value: 1 },
    description: 'Infantry x3: All infantry +1 defense',
  },
  {
    synergyId: 'engineer_synergy',
    name: 'Engineer',
    traitType: 'engineer',
    triggerCount: 2,
    effect: { special: 'fortification_buff' },
    description: 'Engineer x2: Fortification +1 armor, +1 duration',
  },
  {
    synergyId: 'armor_synergy',
    name: 'Armor',
    traitType: 'armor',
    triggerCount: 2,
    effect: { stat: 'speed', value: 1 },
    description: 'Armor x2: Armored cars and tanks +1 speed',
  },
  {
    synergyId: 'artillery_synergy',
    name: 'Artillery',
    traitType: 'artillery',
    triggerCount: 2,
    effect: { stat: 'attack', value: 1 },
    description: 'Artillery x2: All artillery +1 attack',
  },
  {
    synergyId: 'air_synergy',
    name: 'Air Force',
    traitType: 'air',
    triggerCount: 2,
    effect: { special: 'dodge_chance_25' },
    description: 'Air x2: Aircraft 25% chance to dodge non-AA damage',
  },
];

// =============================================
// Trait Definitions
// =============================================

export const TRAIT_DEFINITIONS = {
  armor_pierce: {
    id: 'armor_pierce' as const,
    name: 'Armor Pierce',
    description: '+1 damage vs armor per star level',
    applicableTo: ['infantry', 'armored_car', 'tank', 'artillery', 'anti_air', 'aircraft'] as const,
  },
  blitz: {
    id: 'blitz' as const,
    name: 'Blitz',
    description: '30% chance per star level to attack again',
    applicableTo: ['infantry', 'armored_car', 'tank', 'artillery', 'anti_air', 'aircraft'] as const,
  },
  heavy_cannon: {
    id: 'heavy_cannon' as const,
    name: 'Heavy Cannon',
    description: '+1 attack per star, -1 speed per star (min 0)',
    applicableTo: ['tank', 'artillery'] as const,
  },
  sniper: {
    id: 'sniper' as const,
    name: 'Sniper',
    description: '+1 range per star level',
    applicableTo: ['artillery', 'aircraft'] as const,
  },
  tenacity: {
    id: 'tenacity' as const,
    name: 'Tenacity',
    description: '+1 max HP per star level',
    applicableTo: ['infantry', 'engineer', 'armored_car', 'tank', 'artillery', 'anti_air', 'aircraft'] as const,
  },
};

// Get unit definition by type
export function getUnitDefinition(typeId: string): UnitDefinition | undefined {
  return UNIT_DEFINITIONS[typeId];
}

// Get all synergies
export function getSynergies(): Synergy[] {
  return SYNERGY_DEFINITIONS;
}

// Calculate synergy for a player's board
export function calculateActiveSynergies(pieces: { typeId: string }[]): Map<string, number> {
  const traitCounts = new Map<string, number>();
  
  for (const piece of pieces) {
    const def = getUnitDefinition(piece.typeId);
    if (def) {
      for (const trait of def.traits) {
        traitCounts.set(trait, (traitCounts.get(trait) || 0) + 1);
      }
    }
  }
  
  return traitCounts;
}
