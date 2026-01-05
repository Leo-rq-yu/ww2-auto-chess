import { v4 as uuidv4 } from 'uuid';
import { 
  ShopCard, 
  ShopState, 
  Piece, 
  UnitTypeId, 
  PieceTrait, 
  TraitId,
  SHOP_SIZE, 
  REFRESH_COST 
} from '../types';
import { UNIT_DEFINITIONS, TRAIT_DEFINITIONS } from '../types/units';
import { getShopOdds } from './economy';

// =============================================
// Shop System
// =============================================

// Pool sizes for each cost tier
const POOL_SIZES: Record<number, number> = {
  1: 30,  // 30 copies of each 1-cost unit
  2: 22,  // 22 copies of each 2-cost unit
  3: 16,  // 16 copies of each 3-cost unit
};

// Units by cost
const UNITS_BY_COST: Record<number, UnitTypeId[]> = {
  1: ['infantry', 'engineer'],
  2: ['armored_car', 'anti_air'],
  3: ['tank', 'artillery', 'aircraft'],
};

// Create the shared card pool for a match
export function createCardPool(): Map<UnitTypeId, number> {
  const pool = new Map<UnitTypeId, number>();
  
  for (const [cost, units] of Object.entries(UNITS_BY_COST)) {
    const poolSize = POOL_SIZES[parseInt(cost)];
    for (const unit of units) {
      pool.set(unit, poolSize);
    }
  }
  
  return pool;
}

// Pick a random cost tier based on player level
function pickCostTier(playerLevel: number): number {
  const odds = getShopOdds(playerLevel);
  const roll = Math.random() * 100;
  
  let cumulative = 0;
  for (const [cost, chance] of Object.entries(odds)) {
    cumulative += chance;
    if (roll < cumulative) {
      return parseInt(cost);
    }
  }
  
  return 1;  // Default to cost 1
}

// Pick a random unit from a cost tier
function pickUnitFromTier(cost: number, pool: Map<UnitTypeId, number>): UnitTypeId | null {
  const units = UNITS_BY_COST[cost];
  if (!units) return null;
  
  // Filter to units still available in pool
  const available = units.filter(u => (pool.get(u) || 0) > 0);
  if (available.length === 0) return null;
  
  return available[Math.floor(Math.random() * available.length)];
}

// Generate random traits for a card
function generateTraits(unitTypeId: UnitTypeId): PieceTrait[] {
  const traits: PieceTrait[] = [];
  
  // 50% chance to get a trait
  if (Math.random() < 0.5) {
    // Get applicable traits for this unit type
    const applicableTraits = Object.values(TRAIT_DEFINITIONS).filter(
      t => (t.applicableTo as readonly string[]).includes(unitTypeId)
    );
    
    if (applicableTraits.length > 0) {
      const randomTrait = applicableTraits[Math.floor(Math.random() * applicableTraits.length)];
      traits.push({
        traitId: randomTrait.id,
        level: 1,  // Start at level 1, will stack on merge
      });
    }
  }
  
  return traits;
}

// Generate shop cards for a player
export function generateShopCards(
  playerLevel: number,
  pool: Map<UnitTypeId, number>
): ShopCard[] {
  const cards: ShopCard[] = [];
  
  for (let i = 0; i < SHOP_SIZE; i++) {
    const cost = pickCostTier(playerLevel);
    const unitTypeId = pickUnitFromTier(cost, pool);
    
    if (unitTypeId) {
      const def = UNIT_DEFINITIONS[unitTypeId];
      cards.push({
        index: i,
        typeId: unitTypeId,
        cost: def.cost,
        traits: generateTraits(unitTypeId),
        purchased: false,
      });
    }
  }
  
  return cards;
}

// Create initial shop state
export function createShopState(playerLevel: number, pool: Map<UnitTypeId, number>): ShopState {
  return {
    cards: generateShopCards(playerLevel, pool),
    refreshCost: REFRESH_COST,
  };
}

// Refresh shop (costs gold)
export function refreshShop(
  _shop: ShopState,
  playerLevel: number,
  pool: Map<UnitTypeId, number>,
  returnedCards: ShopCard[]
): ShopState {
  // Return unpurchased cards to pool
  for (const card of returnedCards) {
    if (!card.purchased) {
      const current = pool.get(card.typeId) || 0;
      pool.set(card.typeId, current + 1);
    }
  }
  
  return {
    cards: generateShopCards(playerLevel, pool),
    refreshCost: REFRESH_COST,
  };
}

// Purchase card from shop
export function purchaseCard(
  shop: ShopState,
  cardIndex: number,
  pool: Map<UnitTypeId, number>
): { shop: ShopState; card: ShopCard | null } {
  const card = shop.cards[cardIndex];
  if (!card || card.purchased) {
    return { shop, card: null };
  }
  
  // Remove from pool
  const current = pool.get(card.typeId) || 0;
  if (current > 0) {
    pool.set(card.typeId, current - 1);
  }
  
  // Mark as purchased
  const newCards = [...shop.cards];
  newCards[cardIndex] = { ...card, purchased: true };
  
  return {
    shop: { ...shop, cards: newCards },
    card,
  };
}

// Create a piece from a purchased card
export function createPieceFromCard(
  card: ShopCard,
  ownerId: string,
  matchId: string
): Piece {
  const def = UNIT_DEFINITIONS[card.typeId];
  
  return {
    id: uuidv4(),
    typeId: card.typeId,
    ownerId,
    matchId,
    level: 1,
    currentHp: def.baseHp,
    maxHp: def.baseHp,
    attack: Math.floor((def.baseAttackMin + def.baseAttackMax) / 2),
    attackMin: def.baseAttackMin,
    attackMax: def.baseAttackMax,
    defense: def.baseDefense,
    speed: def.baseSpeed,
    range: def.baseRange,
    position: null,
    isOnBoard: false,
    benchSlot: null,
    status: 'idle',
    facingUp: true,
    traits: card.traits,
  };
}

// Check if three pieces can merge
export function canMerge(pieces: Piece[]): boolean {
  if (pieces.length !== 3) return false;
  
  const first = pieces[0];
  return pieces.every(p => 
    p.typeId === first.typeId && 
    p.level === first.level &&
    p.level < 3  // Max star level is 3
  );
}

// Star upgrade bonuses (simplified - each star adds percentage)
const STAR_BONUS = {
  2: { hp: 1.5, attack: 1.3, defense: 1.2 },
  3: { hp: 2.0, attack: 1.6, defense: 1.5 },
};

// Merge three pieces into higher star
export function mergePieces(pieces: Piece[]): Piece {
  if (!canMerge(pieces)) {
    throw new Error('Cannot merge these pieces');
  }
  
  const [base] = pieces;
  const newLevel = base.level + 1;
  const def = UNIT_DEFINITIONS[base.typeId];
  
  // Calculate upgraded stats using multiplier
  const bonus = STAR_BONUS[newLevel as 2 | 3] || STAR_BONUS[2];
  
  // Merge traits (keep highest level, cap at star level)
  const mergedTraits = new Map<TraitId, number>();
  for (const piece of pieces) {
    for (const trait of piece.traits) {
      const current = mergedTraits.get(trait.traitId) || 0;
      mergedTraits.set(trait.traitId, Math.min(newLevel, current + trait.level));
    }
  }
  
  const traits: PieceTrait[] = Array.from(mergedTraits.entries())
    .slice(0, newLevel)  // Limit traits to star level
    .map(([traitId, level]) => ({ traitId, level }));
  
  // Calculate new stats with bonuses
  const newHp = Math.floor(def.baseHp * bonus.hp);
  
  return {
    ...base,
    id: uuidv4(),
    level: newLevel,
    maxHp: newHp,
    currentHp: newHp,
    attackMin: Math.floor(def.baseAttackMin * bonus.attack),
    attackMax: Math.floor(def.baseAttackMax * bonus.attack),
    defense: Math.floor(def.baseDefense * bonus.defense),
    speed: def.baseSpeed,
    range: def.baseRange,
    traits,
    status: 'idle',
  };
}

// Find merge candidates in a player's pieces
export function findMergeCandidates(pieces: Piece[]): Piece[][] {
  const groups = new Map<string, Piece[]>();
  
  for (const piece of pieces) {
    const key = `${piece.typeId}-${piece.level}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(piece);
  }
  
  return Array.from(groups.values()).filter(group => group.length >= 3);
}

