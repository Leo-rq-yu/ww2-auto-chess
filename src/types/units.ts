// Unit type definitions
export type UnitType = 
  | 'infantry' 
  | 'engineer' 
  | 'armored_car' 
  | 'tank' 
  | 'artillery' 
  | 'anti_air' 
  | 'aircraft'

export type AttackType = 'melee' | 'ranged' | 'aoe' | 'line_sweep'
export type TraitType = 
  | 'armor_piercing' 
  | 'blitz' 
  | 'heavy_cannon' 
  | 'sniper' 
  | 'tenacity'

export interface UnitDefinition {
  type: UnitType
  name: string
  baseHp: number
  baseAttack: [number, number] // [min, max]
  baseArmor: number
  attackType: AttackType
  range: number
  speed: number
  cost: number
  image: string
}

export interface Trait {
  type: TraitType
  name: string
  description: string
}

export interface Unit {
  id: string
  type: UnitType
  starLevel: number // 1, 2, 3
  hp: number
  maxHp: number
  attack: [number, number]
  armor: number
  attackType: AttackType
  range: number
  speed: number
  traits: TraitType[]
  x?: number // Board position
  y?: number
}

export interface Fortification {
  id: string
  x: number
  y: number
  armor: number
  remainingTurns: number
}

// Unit definitions
export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  infantry: {
    type: 'infantry',
    name: 'Infantry',
    baseHp: 2,
    baseAttack: [1, 2],
    baseArmor: 0,
    attackType: 'melee',
    range: 1,
    speed: 2,
    cost: 1,
    image: '/assets/images/infantry.webp',
  },
  engineer: {
    type: 'engineer',
    name: 'Engineer',
    baseHp: 2,
    baseAttack: [0, 0],
    baseArmor: 0,
    attackType: 'melee',
    range: 0,
    speed: 2,
    cost: 1,
    image: '/assets/images/engineer.webp',
  },
  armored_car: {
    type: 'armored_car',
    name: 'Armored Car',
    baseHp: 4,
    baseAttack: [2, 3],
    baseArmor: 1,
    attackType: 'melee',
    range: 1,
    speed: 3,
    cost: 2,
    image: '/assets/images/armored-cars.webp',
  },
  tank: {
    type: 'tank',
    name: 'Tank',
    baseHp: 6,
    baseAttack: [3, 4],
    baseArmor: 2,
    attackType: 'melee',
    range: 1,
    speed: 1,
    cost: 3,
    image: '/assets/images/tank.webp',
  },
  artillery: {
    type: 'artillery',
    name: 'Artillery',
    baseHp: 3,
    baseAttack: [3, 4],
    baseArmor: 0,
    attackType: 'aoe',
    range: 3,
    speed: 0,
    cost: 3,
    image: '/assets/images/artillery.webp',
  },
  anti_air: {
    type: 'anti_air',
    name: 'Anti-Air',
    baseHp: 3,
    baseAttack: [2, 3],
    baseArmor: 0,
    attackType: 'aoe',
    range: 3,
    speed: 1,
    cost: 2,
    image: '/assets/images/anti-air.webp',
  },
  aircraft: {
    type: 'aircraft',
    name: 'Aircraft',
    baseHp: 4,
    baseAttack: [2, 3],
    baseArmor: 0,
    attackType: 'line_sweep',
    range: 2,
    speed: 2,
    cost: 3,
    image: '/assets/images/aircraft.webp',
  },
}

// Trait definitions
export const TRAITS: Record<TraitType, Trait> = {
  armor_piercing: {
    type: 'armor_piercing',
    name: 'Armor Piercing',
    description: '+damage vs armored units',
  },
  blitz: {
    type: 'blitz',
    name: 'Blitz',
    description: 'Chance for extra attack',
  },
  heavy_cannon: {
    type: 'heavy_cannon',
    name: 'Heavy Cannon',
    description: '+attack, -speed',
  },
  sniper: {
    type: 'sniper',
    name: 'Sniper',
    description: '+range',
  },
  tenacity: {
    type: 'tenacity',
    name: 'Tenacity',
    description: '+HP',
  },
}

// Synergy definitions
export type SynergyType = 
  | 'infantry' 
  | 'engineering' 
  | 'armor' 
  | 'artillery' 
  | 'air_force'

export interface SynergyDefinition {
  type: SynergyType
  name: string
  thresholds: number[] // Required unit count
  effects: string[]
}

export const SYNERGIES: Record<SynergyType, SynergyDefinition> = {
  infantry: {
    type: 'infantry',
    name: 'Infantry',
    thresholds: [3],
    effects: ['Infantry +1 armor'],
  },
  engineering: {
    type: 'engineering',
    name: 'Engineering',
    thresholds: [2],
    effects: ['Fortifications +1 armor, +1 turn duration'],
  },
  armor: {
    type: 'armor',
    name: 'Armor',
    thresholds: [2],
    effects: ['Armored units +1 speed'],
  },
  artillery: {
    type: 'artillery',
    name: 'Artillery',
    thresholds: [2],
    effects: ['Artillery +1 attack'],
  },
  air_force: {
    type: 'air_force',
    name: 'Air Force',
    thresholds: [2],
    effects: ['Aircraft 25% chance to ignore one non-AA hit'],
  },
}

// Unit type to synergy type mapping
export const UNIT_TO_SYNERGY: Record<UnitType, SynergyType[]> = {
  infantry: ['infantry'],
  engineer: ['engineering'],
  armored_car: ['armor'],
  tank: ['armor'],
  artillery: ['artillery'],
  anti_air: [],
  aircraft: ['air_force'],
}
