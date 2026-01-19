// =============================================
// WW2 Auto-Chess Type Definitions
// =============================================

// ==================== POSITION ====================
export interface Position {
  x: number;
  y: number;
}

// ==================== UNIT TYPES ====================
export type UnitTypeId =
  | 'infantry'
  | 'engineer'
  | 'armored_car'
  | 'tank'
  | 'artillery'
  | 'anti_air'
  | 'aircraft';

export type AttackType =
  | 'melee' // Single target melee
  | 'ranged' // Single target ranged
  | 'aoe_radius' // Radius AOE
  | 'line_sweep'; // Line sweep

export type TraitType = 'infantry' | 'engineer' | 'armor' | 'artillery' | 'air';

// ==================== TRAITS ====================
export type TraitId =
  | 'armor_pierce' // Armor Pierce
  | 'blitz' // Blitz
  | 'heavy_cannon' // Heavy Cannon
  | 'sniper' // Sniper
  | 'tenacity'; // Tenacity

export interface Trait {
  id: TraitId;
  name: string;
  description: string;
  level: number; // 1-3 based on star level
  applicableTo: UnitTypeId[]; // Which units can have this trait
}

// ==================== UNIT DEFINITION ====================
export interface UnitDefinition {
  typeId: UnitTypeId;
  name: string;
  cost: number;
  baseHp: number;
  baseAttackMin: number;
  baseAttackMax: number;
  baseDefense: number;
  baseSpeed: number; // 0 = cannot move
  baseRange: number;
  attackType: AttackType;
  isAirUnit: boolean;
  traits: TraitType[];
  description: string;
  imageUrl: string;
}

// ==================== PIECE (Battle Unit Instance) ====================
export interface Piece {
  id: string;
  typeId: UnitTypeId;
  ownerId: string;
  matchId: string;

  // Stats
  level: number; // 1, 2, or 3 stars
  currentHp: number;
  maxHp: number;
  attack: number;
  attackMin: number;
  attackMax: number;
  defense: number;
  speed: number;
  range: number;

  // Position
  position: Position | null; // null if on bench
  isOnBoard: boolean;
  benchSlot: number | null;

  // Combat state
  status: PieceStatus;
  facingUp: boolean;

  // Traits
  traits: PieceTrait[];

  // Fortification - only for units that received engineer buff
  fortification?: Fortification;
}

export type PieceStatus = 'idle' | 'wandering' | 'moving' | 'attacking' | 'dying' | 'dead';

export interface PieceTrait {
  traitId: TraitId;
  level: number; // Stacks based on star level, max = current star level
}

export interface Fortification {
  armor: number;
  remainingTurns: number;
}

// ==================== BOARD STATE ====================
export interface BoardState {
  pieces: Record<string, Piece>;
  piecePositions: Record<string, string>; // "x,y" -> pieceId
  size: { width: number; height: number };
}

// ==================== SYNERGY ====================
export interface Synergy {
  synergyId: string;
  name: string;
  traitType: TraitType;
  triggerCount: number;
  effect: SynergyEffect;
  description: string;
}

export interface SynergyEffect {
  stat?: keyof Pick<Piece, 'defense' | 'speed' | 'attack'>;
  value?: number;
  special?: string; // Special effects like "fortification_buff" or "dodge_chance"
}

export interface ActiveSynergy {
  synergyId: string;
  count: number;
  isActive: boolean;
}

// ==================== SHOP & CARDS ====================
export interface ShopCard {
  index: number;
  typeId: UnitTypeId;
  cost: number;
  traits: PieceTrait[];
  purchased: boolean;
}

export interface ShopState {
  cards: ShopCard[];
  refreshCost: number;
}

// ==================== PLAYER ====================
export interface Player {
  id: string;
  matchId: string;
  name: string;

  // Resources
  hp: number;
  money: number;
  level: number;

  // Status
  isReady: boolean;
  isAlive: boolean;
  isBot: boolean;
  placement: number | null;

  // Streaks
  winStreak: number;
  loseStreak: number;
  lastOpponentId: string | null;
}

// ==================== MATCH ====================
export type MatchStatus =
  | 'waiting' // Waiting for players
  | 'starting' // About to start
  | 'preparation' // Preparation phase
  | 'battle' // Battle phase
  | 'finished'; // Game over

export type GamePhase = 'preparation' | 'battle' | 'settlement';

export interface Match {
  matchId: string;
  status: MatchStatus;
  phase: GamePhase;
  turnNumber: number;
  maxPlayers: number;
  winnerId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== BATTLE ====================
export interface BattlePairing {
  player1Id: string;
  player2Id: string;
}

export interface BattleResult {
  winnerId: string | null; // null for draw
  loserId: string | null;
  winnerSurvivors: number;
  loserSurvivors: number;
  damageDealt: number;
  isDraw: boolean;
  player1Id?: string; // For draw handling
  player2Id?: string;
}

export interface BattleEvent {
  turn: number;
  type: 'move' | 'attack' | 'hit' | 'death' | 'fortification';
  pieceId: string;
  targetId?: string;
  from?: Position;
  to?: Position;
  damage?: number;
}

// ==================== COMBAT STATE ====================
export interface CombatState {
  type: 'wandering' | 'attacking' | 'dying';
  targetId?: string;
  dieAtTurn?: number;
}

export interface PieceCombatInfo {
  state: CombatState;
  canMoveAtTurn: number;
  canBeAttackedAtTurn: number;
  canAttackAtTurn: number;
}

// ==================== AI BOT ====================
export type BotActionType =
  | 'BUY'
  | 'SELL'
  | 'MOVE'
  | 'DEPLOY'
  | 'UNDEPLOY'
  | 'MERGE'
  | 'REFRESH'
  | 'READY';

export interface BotAction {
  type: BotActionType;
  payload: Record<string, unknown>;
}

// ==================== GAME CONSTANTS ====================
export const BOARD_WIDTH = 6;
export const BOARD_HEIGHT = 6;
export const BENCH_SIZE = 8;
export const MAX_PLAYERS = 8;
export const STARTING_HP = 50;
export const STARTING_MONEY = 5;
export const BASE_INCOME = 5;
export const SHOP_SIZE = 5;
export const REFRESH_COST = 2;
export const WAITING_TIMEOUT_SECONDS = 30;

// ==================== UPGRADE FORMULAS ====================
export interface StarUpgrade {
  hpBonus: number;
  attackMinBonus: number;
  attackMaxBonus: number;
  defenseBonus: number;
  speedBonus: number;
  rangeBonus: number;
  special?: string;
}

export const STAR_UPGRADES: Record<UnitTypeId, { star2: StarUpgrade; star3: StarUpgrade }> = {
  infantry: {
    star2: {
      hpBonus: 1,
      attackMinBonus: 0,
      attackMaxBonus: 1,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 0,
    },
    star3: {
      hpBonus: 1,
      attackMinBonus: 1,
      attackMaxBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 0,
    },
  },
  engineer: {
    star2: {
      hpBonus: 0,
      attackMinBonus: 0,
      attackMaxBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 0,
      special: 'fortification_armor+1_duration+1',
    },
    star3: {
      hpBonus: 0,
      attackMinBonus: 0,
      attackMaxBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 0,
      special: 'fortification_armor+1_duration+1',
    },
  },
  armored_car: {
    star2: {
      hpBonus: 1,
      attackMinBonus: 0,
      attackMaxBonus: 0,
      defenseBonus: 0,
      speedBonus: 1,
      rangeBonus: 0,
    },
    star3: {
      hpBonus: 1,
      attackMinBonus: 0,
      attackMaxBonus: 0,
      defenseBonus: 1,
      speedBonus: 0,
      rangeBonus: 0,
    },
  },
  tank: {
    star2: {
      hpBonus: 2,
      attackMinBonus: 1,
      attackMaxBonus: 1,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 0,
    },
    star3: {
      hpBonus: 2,
      attackMinBonus: 0,
      attackMaxBonus: 0,
      defenseBonus: 1,
      speedBonus: 0,
      rangeBonus: 0,
    },
  },
  artillery: {
    star2: {
      hpBonus: 0,
      attackMinBonus: 1,
      attackMaxBonus: 1,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 1,
    },
    star3: {
      hpBonus: 0,
      attackMinBonus: 1,
      attackMaxBonus: 1,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 0,
      special: 'aoe_radius+1',
    },
  },
  anti_air: {
    star2: {
      hpBonus: 1,
      attackMinBonus: 0,
      attackMaxBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 0,
      special: 'anti_air_damage+1',
    },
    star3: {
      hpBonus: 0,
      attackMinBonus: 0,
      attackMaxBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 1,
      special: 'anti_air_damage+1',
    },
  },
  aircraft: {
    star2: {
      hpBonus: 1,
      attackMinBonus: 1,
      attackMaxBonus: 1,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 0,
    },
    star3: {
      hpBonus: 1,
      attackMinBonus: 0,
      attackMaxBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      rangeBonus: 0,
      special: 'sweep_width+1',
    },
  },
};
