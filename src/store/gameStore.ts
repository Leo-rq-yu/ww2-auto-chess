import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable Immer support for Map and Set
enableMapSet();
import {
  Match,
  Player,
  Piece,
  BoardState,
  ShopState,
  Position,
  BattleResult,
  BattleEvent,
  ActiveSynergy,
  GamePhase,
  UnitTypeId,
  BOARD_HEIGHT,
  BENCH_SIZE,
} from '../types';
import { updatePlayerMoney } from '../services/matchService';
import { UNIT_DEFINITIONS } from '../types/units';
import {
  createEmptyBoard,
  addPieceToBoard,
  removePieceFromBoard,
  movePiece,
  getPiecesByOwner,
} from '../engine/board';
import {
  createCardPool,
  createShopState,
  purchaseCard,
  createPieceFromCard,
  refreshShop,
  canMerge,
  mergePieces,
  findMergeCandidates,
} from '../engine/shop';
import { getSynergyProgress, SynergyProgress } from '../engine/synergy';
import { calculateRoundIncome, updatePlayerStreaks, calculateSellPrice, getUnitCap } from '../engine/economy';

// =============================================
// Game Store Types
// =============================================

interface GameState {
  // User & Match
  currentUserId: string | null;
  currentUserName: string | null;
  matchId: string | null;
  match: Match | null;
  
  // Players
  players: Player[];
  currentPlayer: Player | null;
  
  // Board & Pieces
  board: BoardState;
  bench: Piece[];
  selectedPieceId: string | null;
  
  // Shop
  shop: ShopState;
  cardPool: Map<UnitTypeId, number>;
  
  // Synergies
  synergies: SynergyProgress[];
  activeSynergies: ActiveSynergy[];
  
  // Battle
  battleBoard: BoardState | null;
  battleEvents: BattleEvent[];
  battleResult: BattleResult | null;
  currentOpponent: Player | null;
  
  // UI State
  phase: GamePhase;
  turnNumber: number;
  phaseTimeRemaining: number;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
}

interface GameActions {
  // Setup
  setUser: (userId: string, userName: string) => void;
  setMatch: (match: Match) => void;
  setPlayers: (players: Player[]) => void;
  resetGame: () => void;
  
  // Shop Actions
  buyCard: (cardIndex: number) => void;
  refreshShop: () => void;
  
  // Board Actions
  selectPiece: (pieceId: string | null) => void;
  placePiece: (pieceId: string, position: Position) => void;
  movePieceOnBoard: (pieceId: string, newPosition: Position) => void;
  deployFromBench: (pieceId: string, position: Position) => void;
  returnToBench: (pieceId: string) => void;
  sellPiece: (pieceId: string) => void;
  
  // Merge
  checkAndMerge: () => void;
  
  // Ready
  toggleReady: () => void;
  
  // Phase Management
  setPhase: (phase: GamePhase) => void;
  setTurnNumber: (turn: number) => void;
  updatePhaseTimer: (time: number) => void;
  
  // Battle
  setBattleState: (board: BoardState, opponent: Player) => void;
  addBattleEvent: (event: BattleEvent) => void;
  setBattleResult: (result: BattleResult) => void;
  clearBattle: () => void;
  
  // Player Updates
  updatePlayerStats: (playerId: string, updates: Partial<Player>) => void;
  applyBattleResult: (result: BattleResult) => void;
  
  // Sync
  syncFromServer: (data: Partial<GameState>) => void;
}

type GameStore = GameState & GameActions;

// =============================================
// Initial State
// =============================================

const initialState: GameState = {
  currentUserId: null,
  currentUserName: null,
  matchId: null,
  match: null,
  players: [],
  currentPlayer: null,
  board: createEmptyBoard(),
  bench: [],
  selectedPieceId: null,
  shop: { cards: [], refreshCost: 2 },
  cardPool: createCardPool(),
  synergies: [],
  activeSynergies: [],
  battleBoard: null,
  battleEvents: [],
  battleResult: null,
  currentOpponent: null,
  phase: 'preparation',
  turnNumber: 0,
  phaseTimeRemaining: 30,
  isReady: false,
  isLoading: false,
  error: null,
};

// =============================================
// Store Implementation
// =============================================

export const useGameStore = create<GameStore>()(
  immer((set) => ({
    ...initialState,

    // Setup Actions
    setUser: (userId, userName) => set(state => {
      state.currentUserId = userId;
      state.currentUserName = userName;
    }),

    setMatch: (match) => set(state => {
      state.match = match;
      state.matchId = match.matchId;
      state.phase = match.phase;
      state.turnNumber = match.turnNumber;
    }),

    setPlayers: (players) => set(state => {
      // If we already have a currentPlayer with modified money/hp, preserve those values
      const existingCurrentPlayer = state.currentPlayer;
      
      state.players = players.map(p => {
        // For current user, preserve local state changes (money, hp, etc.)
        if (p.id === state.currentUserId && existingCurrentPlayer) {
          return {
            ...p,
            money: existingCurrentPlayer.money,
            hp: existingCurrentPlayer.hp,
            winStreak: existingCurrentPlayer.winStreak,
            loseStreak: existingCurrentPlayer.loseStreak,
          };
        }
        return p;
      });
      
      const current = state.players.find(p => p.id === state.currentUserId);
      if (current) {
        state.currentPlayer = current;
      }
    }),

    resetGame: () => set(initialState),

    // Shop Actions
    buyCard: (cardIndex) => set(state => {
      console.log('[Store] buyCard called with index:', cardIndex);
      const card = state.shop.cards[cardIndex];
      
      if (!card || card.purchased || !state.currentPlayer) {
        console.log('[Store] Cannot buy: no card, already purchased, or no player');
        return;
      }
      
      const cost = card.cost;
      if (state.currentPlayer.money < cost) {
        console.log('[Store] Not enough money');
        return;
      }
      
      // Check bench space
      if (state.bench.length >= BENCH_SIZE) {
        console.log('[Store] Bench full');
        return;
      }
      
      // Purchase
      const { shop: newShop, card: purchasedCard } = purchaseCard(
        state.shop,
        cardIndex,
        state.cardPool
      );
      
      if (!purchasedCard) return;
      
      // Create piece
      const piece = createPieceFromCard(
        purchasedCard,
        state.currentUserId!,
        state.matchId!
      );
      
      // Update state
      state.shop = newShop;
      const newMoney = state.currentPlayer.money - cost;
      state.currentPlayer.money = newMoney;
      
      // Also update in players array
      const playerIndex = state.players.findIndex(p => p.id === state.currentUserId);
      if (playerIndex !== -1) {
        state.players[playerIndex].money = newMoney;
      }
      
      // Find empty bench slot
      const usedSlots = new Set(state.bench.map(p => p.benchSlot));
      let slot = 0;
      while (usedSlots.has(slot)) slot++;
      
      piece.benchSlot = slot;
      state.bench.push(piece);
      
      // Update synergies - only count BOARD units, not bench
      const boardPiecesForSynergy = getPiecesByOwner(state.board, state.currentUserId!);
      state.synergies = getSynergyProgress(boardPiecesForSynergy);
      
      console.log('[Store] Card purchased, new money:', newMoney);
      
      // Sync money to database (fire and forget)
      const matchId = state.matchId;
      const playerId = state.currentUserId;
      if (matchId && playerId) {
        updatePlayerMoney(matchId, playerId, newMoney).catch(err => {
          console.warn('[Store] Failed to sync money to database:', err);
        });
      }
    }),

    refreshShop: () => set(state => {
      if (!state.currentPlayer) return;
      
      const cost = state.shop.refreshCost;
      if (state.currentPlayer.money < cost) return;
      
      const newMoney = state.currentPlayer.money - cost;
      state.currentPlayer.money = newMoney;
      
      // Also update in players array
      const playerIndex = state.players.findIndex(p => p.id === state.currentUserId);
      if (playerIndex !== -1) {
        state.players[playerIndex].money = newMoney;
      }
      
      state.shop = refreshShop(
        state.shop,
        state.currentPlayer.level,
        state.cardPool,
        state.shop.cards
      );
      
      // Sync money to database (fire and forget)
      const matchId = state.matchId;
      const playerId = state.currentUserId;
      if (matchId && playerId) {
        updatePlayerMoney(matchId, playerId, newMoney).catch(err => {
          console.warn('[Store] Failed to sync money to database:', err);
        });
      }
    }),

    // Board Actions
    selectPiece: (pieceId) => set(state => {
      state.selectedPieceId = pieceId;
    }),

    placePiece: (pieceId, position) => set(state => {
      // Check if position is valid (player's half only - bottom 3 rows)
      if (position.y < BOARD_HEIGHT / 2) return;
      
      // Check unit cap
      const boardPieces = getPiecesByOwner(state.board, state.currentUserId!);
      const unitCap = getUnitCap(state.currentPlayer?.level || 1);
      if (boardPieces.length >= unitCap) return;
      
      const piece = state.bench.find(p => p.id === pieceId) || state.board.pieces[pieceId];
      if (!piece) return;
      
      // If from bench, remove from bench and add to board
      if (!piece.isOnBoard) {
        state.bench = state.bench.filter(p => p.id !== pieceId);
        const updatedPiece = { ...piece, isOnBoard: true, benchSlot: null, position };
        state.board = addPieceToBoard(state.board, updatedPiece, position);
      } else {
        // Move on board
        state.board = movePiece(state.board, pieceId, position);
      }
      
      state.selectedPieceId = null;
      
      // Update synergies - only count BOARD units
      const boardPiecesForSynergy = getPiecesByOwner(state.board, state.currentUserId!);
      state.synergies = getSynergyProgress(boardPiecesForSynergy);
    }),

    movePieceOnBoard: (pieceId, newPosition) => set(state => {
      state.board = movePiece(state.board, pieceId, newPosition);
    }),

    deployFromBench: (pieceId, position) => set(state => {
      console.log('[Store] deployFromBench called:', pieceId, position);
      const piece = state.bench.find(p => p.id === pieceId);
      if (!piece) {
        console.log('[Store] Piece not found in bench');
        return;
      }
      
      // Check unit cap
      const boardPieces = getPiecesByOwner(state.board, state.currentUserId!);
      const unitCap = getUnitCap(state.currentPlayer?.level || 1);
      console.log('[Store] Board pieces:', boardPieces.length, 'Unit cap:', unitCap, 'Player level:', state.currentPlayer?.level);
      
      if (boardPieces.length >= unitCap) {
        console.log('[Store] Unit cap reached!');
        return;
      }
      
      state.bench = state.bench.filter(p => p.id !== pieceId);
      const updatedPiece = { ...piece, isOnBoard: true, benchSlot: null, position };
      state.board = addPieceToBoard(state.board, updatedPiece, position);
      console.log('[Store] Piece deployed to board');
      
      // Update synergies - only count BOARD units
      const boardPiecesForSynergy = getPiecesByOwner(state.board, state.currentUserId!);
      state.synergies = getSynergyProgress(boardPiecesForSynergy);
    }),

    returnToBench: (pieceId) => set(state => {
      const piece = state.board.pieces[pieceId];
      if (!piece || state.bench.length >= BENCH_SIZE) return;
      
      state.board = removePieceFromBoard(state.board, pieceId);
      
      // Find empty bench slot
      const usedSlots = new Set(state.bench.map(p => p.benchSlot));
      let slot = 0;
      while (usedSlots.has(slot)) slot++;
      
      const benchPiece = { ...piece, isOnBoard: false, benchSlot: slot, position: null };
      state.bench.push(benchPiece);
      
      // Update synergies - only count BOARD units
      const boardPiecesForSynergy = getPiecesByOwner(state.board, state.currentUserId!);
      state.synergies = getSynergyProgress(boardPiecesForSynergy);
    }),

    sellPiece: (pieceId) => set(state => {
      if (!state.currentPlayer) return;
      
      const piece = state.board.pieces[pieceId] || state.bench.find(p => p.id === pieceId);
      if (!piece) return;
      
      const def = UNIT_DEFINITIONS[piece.typeId];
      const sellPrice = calculateSellPrice(def.cost, piece.level);
      
      if (piece.isOnBoard) {
        state.board = removePieceFromBoard(state.board, pieceId);
      } else {
        state.bench = state.bench.filter(p => p.id !== pieceId);
      }
      
      const newMoney = state.currentPlayer.money + sellPrice;
      state.currentPlayer.money = newMoney;
      
      // Also update in players array
      const playerIndex = state.players.findIndex(p => p.id === state.currentUserId);
      if (playerIndex !== -1) {
        state.players[playerIndex].money = newMoney;
      }
      
      // Return to pool
      const poolCount = state.cardPool.get(piece.typeId) || 0;
      const returnCount = Math.pow(3, piece.level - 1);  // 1 for 1*, 3 for 2*, 9 for 3*
      state.cardPool.set(piece.typeId, poolCount + returnCount);
      
      // Update synergies - only count BOARD units
      const boardPiecesForSynergy = getPiecesByOwner(state.board, state.currentUserId!);
      state.synergies = getSynergyProgress(boardPiecesForSynergy);
      
      // Sync money to database (fire and forget)
      const matchId = state.matchId;
      const playerId = state.currentUserId;
      if (matchId && playerId) {
        updatePlayerMoney(matchId, playerId, newMoney).catch(err => {
          console.warn('[Store] Failed to sync money to database:', err);
        });
      }
    }),

    // Merge
    checkAndMerge: () => set(state => {
      const allPieces = [...Object.values(state.board.pieces), ...state.bench]
        .filter(p => p.ownerId === state.currentUserId);
      
      const candidates = findMergeCandidates(allPieces);
      
      for (const group of candidates) {
        if (group.length >= 3 && canMerge(group.slice(0, 3))) {
          const [p1, p2, p3] = group.slice(0, 3);
          const merged = mergePieces([p1, p2, p3]);
          
          // Remove original pieces
          for (const p of [p1, p2, p3]) {
            if (p.isOnBoard) {
              state.board = removePieceFromBoard(state.board, p.id);
            } else {
              state.bench = state.bench.filter(bp => bp.id !== p.id);
            }
          }
          
          // Add merged piece to bench
          const usedSlots = new Set(state.bench.map(p => p.benchSlot));
          let slot = 0;
          while (usedSlots.has(slot)) slot++;
          
          merged.benchSlot = slot;
          merged.isOnBoard = false;
          merged.position = null;
          state.bench.push(merged);
        }
      }
      
      // Update synergies - only count BOARD units
      const boardPiecesForSynergy = getPiecesByOwner(state.board, state.currentUserId!);
      state.synergies = getSynergyProgress(boardPiecesForSynergy);
    }),

    // Ready
    toggleReady: () => set(state => {
      state.isReady = !state.isReady;
    }),

    // Phase Management
    setPhase: (phase) => set(state => {
      state.phase = phase;
      state.isReady = false;
      
      if (phase === 'preparation') {
        // Generate new shop
        if (state.currentPlayer) {
          state.shop = createShopState(state.currentPlayer.level, state.cardPool);
        }
      }
    }),

    setTurnNumber: (turn) => set(state => {
      state.turnNumber = turn;
    }),

    updatePhaseTimer: (time) => set(state => {
      state.phaseTimeRemaining = time;
    }),

    // Battle
    setBattleState: (board, opponent) => set(state => {
      state.battleBoard = board;
      state.currentOpponent = opponent;
      state.battleEvents = [];
      state.battleResult = null;
    }),

    addBattleEvent: (event) => set(state => {
      state.battleEvents.push(event);
    }),

    setBattleResult: (result) => set(state => {
      state.battleResult = result;
    }),

    clearBattle: () => set(state => {
      state.battleBoard = null;
      state.battleEvents = [];
      state.battleResult = null;
      state.currentOpponent = null;
    }),

    // Player Updates
    updatePlayerStats: (playerId, updates) => set(state => {
      const playerIndex = state.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        state.players[playerIndex] = { ...state.players[playerIndex], ...updates };
        
        if (playerId === state.currentUserId) {
          state.currentPlayer = state.players[playerIndex];
        }
      }
    }),

    applyBattleResult: (result) => set(state => {
      if (!state.currentPlayer || !result) return;
      
      const isWinner = result.winnerId === state.currentUserId;
      const isDraw = result.isDraw;
      
      // Update streaks for current player
      const streaks = updatePlayerStreaks(state.currentPlayer, isWinner, isDraw);
      state.currentPlayer.winStreak = streaks.winStreak;
      state.currentPlayer.loseStreak = streaks.loseStreak;
      
      // Apply damage if lost
      if (!isWinner && !isDraw) {
        state.currentPlayer.hp = Math.max(0, state.currentPlayer.hp - result.damageDealt);
      } else if (isDraw) {
        state.currentPlayer.hp = Math.max(0, state.currentPlayer.hp - 5);
      }
      
      // Calculate income
      const income = calculateRoundIncome(state.currentPlayer, result, isWinner);
      state.currentPlayer.money += income;
      
      // Check if eliminated
      if (state.currentPlayer.hp <= 0) {
        state.currentPlayer.isAlive = false;
      }
      
      // Sync changes to players array
      const playerIndex = state.players.findIndex(p => p.id === state.currentUserId);
      if (playerIndex !== -1) {
        state.players[playerIndex] = { ...state.currentPlayer };
      }
      
      // Update loser's HP in players array (for ranking display)
      // This works regardless of whether we won or lost
      if (result.loserId && !isDraw) {
        const loserIndex = state.players.findIndex(p => p.id === result.loserId);
        if (loserIndex !== -1) {
          const newHp = Math.max(0, state.players[loserIndex].hp - result.damageDealt);
          state.players[loserIndex].hp = newHp;
          state.players[loserIndex].isAlive = newHp > 0;
          console.log(`[Store] Updated loser ${result.loserId.slice(0,8)} HP: ${newHp}`);
        }
      }
      
      // For draws, both players take damage
      if (isDraw && result.player1Id && result.player2Id) {
        [result.player1Id, result.player2Id].forEach(pid => {
          if (pid !== state.currentUserId) {
            const idx = state.players.findIndex(p => p.id === pid);
            if (idx !== -1) {
              state.players[idx].hp = Math.max(0, state.players[idx].hp - 5);
              state.players[idx].isAlive = state.players[idx].hp > 0;
            }
          }
        });
      }
      
      // Sync money to database after battle income (fire and forget)
      const matchId = state.matchId;
      const playerId = state.currentUserId;
      const newMoney = state.currentPlayer?.money;
      if (matchId && playerId && newMoney !== undefined) {
        updatePlayerMoney(matchId, playerId, newMoney).catch(err => {
          console.warn('[Store] Failed to sync money to database after battle:', err);
        });
      }
    }),

    // Sync
    syncFromServer: (data) => set(state => {
      Object.assign(state, data);
    }),
  }))
);

export default useGameStore;

