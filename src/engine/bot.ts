import {
  Piece,
  Player,
  ShopCard,
  ShopState,
  Position,
  BoardState,
  UnitTypeId,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  BENCH_SIZE,
} from '../types';
import { UNIT_DEFINITIONS } from '../types/units';
import {
  createShopState,
  createPieceFromCard,
  findMergeCandidates,
  canMerge,
  mergePieces,
} from './shop';
import {
  addPieceToBoard,
  getPiecesByOwner,
  getEmptyPositions,
  removePieceFromBoard,
} from './board';
import { getSynergyProgress } from './synergy';
import { getUnitCap, calculateSellPrice } from './economy';

// =============================================
// Bot AI Decision System
// =============================================

export interface BotAction {
  type: 'BUY' | 'DEPLOY' | 'UNDEPLOY' | 'MOVE' | 'SELL' | 'REFRESH' | 'READY' | 'MERGE';
  pieceId?: string;
  cardIndex?: number;
  position?: Position;
  mergeIds?: string[];
}

export interface BotState {
  player: Player;
  board: BoardState;
  bench: Piece[];
  shop: ShopState;
  cardPool: Map<UnitTypeId, number>;
  allPlayers: Player[];
}

export interface BotDecision {
  actions: BotAction[];
  reasoning: string;
}

// Value calculation weights
const WEIGHTS = {
  unitValue: 1.0,
  synergyBonus: 2.0,
  economyThreshold: 50, // Save gold above this for interest
  mergeValue: 3.0,
  frontlineBonus: 0.5,
  backlineBonus: 0.3,
};

// =============================================
// Bot Brain - Decision Making
// =============================================

export class BotBrain {
  private state: BotState;

  constructor(state: BotState) {
    this.state = state;
  }

  // Main decision function
  makeDecisions(): BotDecision {
    const actions: BotAction[] = [];
    const reasoning: string[] = [];

    // Phase 1: Try to merge existing pieces
    const mergeActions = this.tryMerge();
    if (mergeActions.length > 0) {
      actions.push(...mergeActions);
      reasoning.push(`Merged ${mergeActions.length} units`);
    }

    // Phase 2: Buy cards if good value
    const buyActions = this.decideBuys();
    if (buyActions.length > 0) {
      actions.push(...buyActions);
      reasoning.push(`Bought ${buyActions.length} cards`);
    }

    // Phase 3: Deploy units to board
    const deployActions = this.decideDeploy();
    if (deployActions.length > 0) {
      actions.push(...deployActions);
      reasoning.push(`Deployed ${deployActions.length} units`);
    }

    // Phase 4: Optimize positions
    const moveActions = this.optimizePositions();
    if (moveActions.length > 0) {
      actions.push(...moveActions);
      reasoning.push(`Adjusted ${moveActions.length} positions`);
    }

    // Phase 5: Refresh shop if money and no good cards
    if (this.shouldRefreshShop()) {
      actions.push({ type: 'REFRESH' });
      reasoning.push('Refreshed shop');
    }

    // Phase 6: Mark ready
    actions.push({ type: 'READY' });
    reasoning.push('Ready');

    return {
      actions,
      reasoning: reasoning.join('; '),
    };
  }

  // Try to merge pieces
  private tryMerge(): BotAction[] {
    const actions: BotAction[] = [];
    const allPieces = [
      ...Object.values(this.state.board.pieces).filter(p => p.ownerId === this.state.player.id),
      ...this.state.bench,
    ];

    const candidates = findMergeCandidates(allPieces);

    for (const group of candidates) {
      if (group.length >= 3 && canMerge(group.slice(0, 3))) {
        actions.push({
          type: 'MERGE',
          mergeIds: group.slice(0, 3).map(p => p.id),
        });
        break; // One merge per decision cycle
      }
    }

    return actions;
  }

  // Decide which cards to buy
  private decideBuys(): BotAction[] {
    const actions: BotAction[] = [];
    const { shop, bench } = this.state;

    // Don't buy if bench is full
    if (bench.length >= BENCH_SIZE) return actions;

    // Calculate how much we can spend
    const maxSpend = this.calculateMaxSpend();
    let spent = 0;

    // Evaluate each card
    const cardValues = shop.cards
      .map((card, index) => ({
        card,
        index,
        value: card.purchased ? -1 : this.evaluateCard(card),
      }))
      .filter(c => c.value > 0 && !c.card.purchased)
      .sort((a, b) => b.value - a.value);

    // Buy best cards within budget
    for (const { card, index, value } of cardValues) {
      if (spent + card.cost > maxSpend) continue;
      if (bench.length + actions.length >= BENCH_SIZE) break;

      // Higher value threshold for expensive units
      const threshold = card.cost * 0.8;
      if (value >= threshold) {
        actions.push({ type: 'BUY', cardIndex: index });
        spent += card.cost;
      }
    }

    return actions;
  }

  // Calculate how much gold bot should spend
  private calculateMaxSpend(): number {
    const { player } = this.state;
    const money = player.money;

    // Early game: spend more freely
    if (player.level <= 3) {
      return money;
    }

    // Mid game: save for interest (10 gold = 1 interest)
    if (player.level <= 6) {
      const targetSavings = Math.floor(player.level / 2) * 10;
      return Math.max(0, money - targetSavings);
    }

    // Late game: spend more aggressively if HP is low
    if (player.hp < 20) {
      return money;
    }

    // Otherwise maintain 50 gold for max interest
    return Math.max(0, money - 50);
  }

  // Evaluate a card's value
  private evaluateCard(card: ShopCard): number {
    let value = card.cost; // Base value is cost

    const def = UNIT_DEFINITIONS[card.typeId];
    if (!def) return 0;

    // Bonus for having pairs (potential merge)
    const sameTypeCount = this.countSameType(card.typeId, 1);
    if (sameTypeCount >= 2) {
      value += WEIGHTS.mergeValue * card.cost;
    } else if (sameTypeCount >= 1) {
      value += WEIGHTS.mergeValue * 0.5 * card.cost;
    }

    // Bonus for synergy contribution
    const synergyBonus = this.evaluateSynergyContribution(def.traits);
    value += synergyBonus * WEIGHTS.synergyBonus;

    // Bonus for random traits
    if (card.traits && card.traits.length > 0) {
      value += card.traits.length * 0.5;
    }

    // Unit type preferences based on typeId
    if (card.typeId === 'tank') {
      value *= 1.2; // Tanks are valuable
    } else if (card.typeId === 'artillery') {
      value *= 1.1; // Artillery good for damage
    } else if (card.typeId === 'engineer') {
      value *= 0.8; // Engineers less valuable without strategy
    }

    return value;
  }

  // Count same type units in possession
  private countSameType(typeId: string, level: number): number {
    const allPieces = [
      ...Object.values(this.state.board.pieces).filter(p => p.ownerId === this.state.player.id),
      ...this.state.bench,
    ];

    return allPieces.filter(p => p.typeId === typeId && p.level === level).length;
  }

  // Evaluate synergy contribution
  private evaluateSynergyContribution(traits: string[]): number {
    const currentSynergies = getSynergyProgress([
      ...Object.values(this.state.board.pieces).filter(p => p.ownerId === this.state.player.id),
      ...this.state.bench,
    ]);

    let bonus = 0;

    for (const trait of traits) {
      const synergy = currentSynergies.find(s => s.synergyId === trait);
      if (synergy) {
        // Close to activation threshold
        if (synergy.currentCount + 1 >= synergy.triggerCount) {
          bonus += 2; // Big bonus for activating synergy
        } else {
          bonus += 0.5; // Small bonus for progress
        }
      }
    }

    return bonus;
  }

  // Decide which units to deploy
  private decideDeploy(): BotAction[] {
    const actions: BotAction[] = [];
    const { player, board, bench } = this.state;

    const unitCap = getUnitCap();
    const currentOnBoard = getPiecesByOwner(board, player.id).length;
    const slotsAvailable = unitCap - currentOnBoard;

    if (slotsAvailable <= 0 || bench.length === 0) return actions;

    // Sort bench by value (higher level, better traits)
    const sortedBench = [...bench].sort((a, b) => {
      const valueA = this.evaluatePiece(a);
      const valueB = this.evaluatePiece(b);
      return valueB - valueA;
    });

    // Get empty positions on player's half (bottom 3 rows: y = 3, 4, 5)
    const emptyPositions = getEmptyPositions(board).filter(pos => pos.y >= BOARD_HEIGHT / 2);

    // Deploy best pieces
    for (let i = 0; i < Math.min(slotsAvailable, sortedBench.length, emptyPositions.length); i++) {
      const piece = sortedBench[i];
      const position = this.chooseBestPosition(piece, emptyPositions);

      if (position) {
        actions.push({
          type: 'DEPLOY',
          pieceId: piece.id,
          position,
        });

        // Remove used position
        const posIndex = emptyPositions.findIndex(p => p.x === position.x && p.y === position.y);
        if (posIndex !== -1) emptyPositions.splice(posIndex, 1);
      }
    }

    return actions;
  }

  // Evaluate a piece's value
  private evaluatePiece(piece: Piece): number {
    const def = UNIT_DEFINITIONS[piece.typeId];
    if (!def) return 0;

    let value = def.cost * piece.level;

    // Trait bonus
    if (piece.traits && piece.traits.length > 0) {
      value += piece.traits.length * 0.5;
    }

    // Higher level bonus
    value += (piece.level - 1) * 2;

    return value;
  }

  // Choose best position for a piece
  private chooseBestPosition(piece: Piece, available: Position[]): Position | null {
    if (available.length === 0) return null;

    const def = UNIT_DEFINITIONS[piece.typeId];
    if (!def) return available[0];

    // Sort positions by preference
    const sorted = [...available].sort((a, b) => {
      const scoreA = this.positionScore(piece, a);
      const scoreB = this.positionScore(piece, b);
      return scoreB - scoreA;
    });

    return sorted[0];
  }

  // Score a position for a piece
  private positionScore(piece: Piece, pos: Position): number {
    const def = UNIT_DEFINITIONS[piece.typeId];
    if (!def) return 0;

    let score = 0;

    // Frontline (y = 3) good for tanks and melee
    // Backline (y = 5) good for ranged and artillery
    if (def.baseRange <= 1) {
      // Melee units prefer front
      score += (BOARD_HEIGHT - 1 - pos.y) * WEIGHTS.frontlineBonus;
    } else {
      // Ranged units prefer back
      score += pos.y * WEIGHTS.backlineBonus;
    }

    // Center positions slightly preferred
    const centerDist = Math.abs(pos.x - BOARD_WIDTH / 2);
    score -= centerDist * 0.1;

    return score;
  }

  // Optimize unit positions
  private optimizePositions(): BotAction[] {
    // For simplicity, bots don't optimize positions after initial deploy
    // This could be expanded for smarter positioning
    return [];
  }

  // Should bot refresh shop?
  private shouldRefreshShop(): boolean {
    const { player, shop, bench } = this.state;

    // Don't refresh if no money
    if (player.money < shop.refreshCost) return false;

    // Don't refresh if bench is full
    if (bench.length >= BENCH_SIZE) return false;

    // Calculate remaining card value
    const remainingValue = shop.cards
      .filter(c => !c.purchased)
      .reduce((sum, c) => sum + this.evaluateCard(c), 0);

    // Refresh if remaining cards are low value
    const avgValue = remainingValue / shop.cards.filter(c => !c.purchased).length;
    return avgValue < 1.5 && player.money > 10;
  }
}

// =============================================
// Bot Action Executor
// =============================================

export function executeBotAction(action: BotAction, state: BotState): BotState {
  const newState = { ...state };

  switch (action.type) {
    case 'BUY': {
      if (action.cardIndex === undefined) break;
      const card = state.shop.cards[action.cardIndex];
      if (!card || card.purchased) break;
      if (state.player.money < card.cost) break;
      if (state.bench.length >= BENCH_SIZE) break;

      // Create piece from card
      const piece = createPieceFromCard(card, state.player.id, state.player.matchId);

      // Find empty bench slot
      const usedSlots = new Set(state.bench.map(p => p.benchSlot));
      let slot = 0;
      while (usedSlots.has(slot)) slot++;
      piece.benchSlot = slot;

      // Update state
      newState.player = { ...state.player, money: state.player.money - card.cost };
      newState.bench = [...state.bench, piece];
      newState.shop = {
        ...state.shop,
        cards: state.shop.cards.map((c, i) =>
          i === action.cardIndex ? { ...c, purchased: true } : c
        ),
      };
      break;
    }

    case 'DEPLOY': {
      if (!action.pieceId || !action.position) break;
      const piece = state.bench.find(p => p.id === action.pieceId);
      if (!piece) break;

      const deployedPiece: Piece = {
        ...piece,
        isOnBoard: true,
        benchSlot: null,
        position: action.position,
      };

      newState.bench = state.bench.filter(p => p.id !== action.pieceId);
      newState.board = addPieceToBoard(state.board, deployedPiece, action.position);
      break;
    }

    case 'UNDEPLOY': {
      if (!action.pieceId) break;
      const piece = state.board.pieces[action.pieceId];
      if (!piece || state.bench.length >= BENCH_SIZE) break;

      // Find empty bench slot
      const usedSlots = new Set(state.bench.map(p => p.benchSlot));
      let slot = 0;
      while (usedSlots.has(slot)) slot++;

      const benchPiece: Piece = {
        ...piece,
        isOnBoard: false,
        benchSlot: slot,
        position: null,
      };

      newState.board = removePieceFromBoard(state.board, action.pieceId);
      newState.bench = [...state.bench, benchPiece];
      break;
    }

    case 'SELL': {
      if (!action.pieceId) break;
      const boardPiece = state.board.pieces[action.pieceId];
      const benchPiece = state.bench.find(p => p.id === action.pieceId);
      const piece = boardPiece || benchPiece;
      if (!piece) break;

      const def = UNIT_DEFINITIONS[piece.typeId];
      const sellPrice = calculateSellPrice(def.cost, piece.level);

      if (boardPiece) {
        newState.board = removePieceFromBoard(state.board, action.pieceId);
      } else {
        newState.bench = state.bench.filter(p => p.id !== action.pieceId);
      }

      newState.player = { ...state.player, money: state.player.money + sellPrice };
      break;
    }

    case 'REFRESH': {
      if (state.player.money < state.shop.refreshCost) break;

      newState.player = { ...state.player, money: state.player.money - state.shop.refreshCost };
      newState.shop = createShopState(state.player.level, state.cardPool);
      break;
    }

    case 'MERGE': {
      if (!action.mergeIds || action.mergeIds.length < 3) break;

      const pieces: Piece[] = [];
      for (const id of action.mergeIds) {
        const boardPiece = state.board.pieces[id];
        const benchPiece = state.bench.find(p => p.id === id);
        if (boardPiece) pieces.push(boardPiece);
        if (benchPiece) pieces.push(benchPiece);
      }

      if (pieces.length < 3 || !canMerge(pieces.slice(0, 3))) break;

      const merged = mergePieces(pieces.slice(0, 3));

      // Remove original pieces
      for (const p of pieces.slice(0, 3)) {
        if (p.isOnBoard) {
          newState.board = removePieceFromBoard(newState.board, p.id);
        } else {
          newState.bench = newState.bench.filter(bp => bp.id !== p.id);
        }
      }

      // Add merged to bench
      const usedSlots = new Set(newState.bench.map(p => p.benchSlot));
      let slot = 0;
      while (usedSlots.has(slot)) slot++;

      merged.benchSlot = slot;
      merged.isOnBoard = false;
      merged.position = null;
      newState.bench = [...newState.bench, merged];
      break;
    }
  }

  return newState;
}

// =============================================
// Generate System Prompt for AI Bot
// =============================================

export function generateBotSystemPrompt(state: BotState): string {
  const { player, board, bench, shop, allPlayers } = state;

  return `You are an AI player in an auto-chess game. Make optimal decisions based on the current game state.

# Game Rules

## Unit Types and Stats
| Unit | HP | Attack | Defense | Attack Type/Range | Speed | Cost |
|------|------|------|------|--------------|---------|------|
| Infantry | 2 | 1-2 | 0 | Melee(1) | 2 | 1 |
| Engineer | 2 | 0 | 0 | No attack | 2 | 1 |
| Armored Car | 4 | 2-3 | 1 | Melee(1) | 3 | 2 |
| Tank | 6 | 3-4 | 2 | Melee(1) | 1 | 3 |
| Artillery | 3 | 3-4 | 0 | AoE(3) | 0-1 | 3 |
| Anti-Air | 3 | 2-3 | 0 | Radius(3) | 1 | 2 |
| Aircraft | 4 | 2-3 | 0 | Line sweep(2) | 2 | 3 |

## Synergy Effects
- Infantry x3: Infantry +1 defense
- Engineer x2: Fortification +1 armor
- Armor x2: Armored car and tank +1 speed
- Artillery x2: Artillery +1 attack
- Air x2: Aircraft 25% dodge

## Merge Rules
- 3 same-star same-type units merge into higher star

# Current State

## Your Info
- Player: ${player.name}
- HP: ${player.hp}/50
- Gold: ${player.money}
- Level: ${player.level}
- Unit Cap: ${getUnitCap()}

## All Players
${allPlayers.map(p => `- ${p.name}: HP=${p.hp}, Gold=${p.money}, ${p.isAlive ? 'Alive' : 'Eliminated'}`).join('\n')}

## Board Units
${
  Object.values(board.pieces)
    .filter(p => p.ownerId === player.id)
    .map(p => {
      const def = UNIT_DEFINITIONS[p.typeId];
      const traitNames = p.traits?.map(t => t.traitId).join(',') || '';
      return `- ${def?.name || p.typeId} ★${p.level} Pos(${p.position?.x},${p.position?.y}) Traits:[${traitNames}]`;
    })
    .join('\n') || 'None'
}

## Bench Units
${
  bench
    .map(p => {
      const def = UNIT_DEFINITIONS[p.typeId];
      const traitNames = p.traits?.map(t => t.traitId).join(',') || '';
      return `- ${def?.name || p.typeId} ★${p.level} Traits:[${traitNames}]`;
    })
    .join('\n') || 'None'
}

## Shop Cards
${shop.cards
  .map((c, i) => {
    const def = UNIT_DEFINITIONS[c.typeId];
    const traitNames = c.traits?.map(t => t.traitId).join(',') || '';
    return `${i}: ${def?.name || c.typeId} ★1 Cost${c.cost} ${c.purchased ? '(Sold)' : ''} Traits:[${traitNames}]`;
  })
  .join('\n')}

# Available Commands
- BUY shop_index: Buy card at slot N
- DEPLOY piece_id TO x,y: Deploy unit to board
- UNDEPLOY piece_id: Return unit to bench
- MOVE piece_id TO x,y: Move unit on board
- SELL piece_id: Sell unit
- REFRESH: Refresh shop (costs 2 gold)
- MERGE piece_id1,piece_id2,piece_id3: Merge three units
- READY: Finish all operations

Return your decision commands, one per line.`;
}

export default BotBrain;
