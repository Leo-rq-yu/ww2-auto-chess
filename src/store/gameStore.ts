import { create } from 'zustand'
import { produce } from 'immer'
import { Match, Player, BoardState, GamePhase, ShopCard } from '../types/game'
import { Unit, ActiveSynergy } from '../types/units'

interface GameState {
  // User & match info
  userId: string | null
  matchId: string | null
  match: Match | null
  
  // Players list
  players: Player[]
  currentPlayer: Player | null
  
  // Board & bench
  boardState: BoardState
  benchState: { pieces: Unit[] }
  
  // Shop
  shopCards: ShopCard[]
  
  // Synergies
  synergies: ActiveSynergy[]
  
  // Battle state
  battleResults: any[]
  
  // Phase management
  phase: GamePhase
  isReady: boolean
  
  // Actions
  setUserId: (userId: string) => void
  setMatch: (match: Match) => void
  setMatchId: (matchId: string) => void
  setPlayers: (players: Player[]) => void
  setCurrentPlayer: (player: Player) => void
  setBoardState: (state: BoardState) => void
  setBenchState: (state: { pieces: Unit[] }) => void
  setShopCards: (cards: ShopCard[]) => void
  setSynergies: (synergies: ActiveSynergy[]) => void
  setPhase: (phase: GamePhase) => void
  setIsReady: (ready: boolean) => void
  addUnitToBench: (unit: Unit) => void
  removeUnitFromBench: (unitId: string) => void
  placeUnitOnBoard: (unitId: string, x: number, y: number) => void
  removeUnitFromBoard: (x: number, y: number) => void
  updateUnit: (unitId: string, updates: Partial<Unit>) => void
  reset: () => void
}

const initialState = {
  userId: null,
  matchId: null,
  match: null,
  players: [],
  currentPlayer: null,
  boardState: { pieces: [], fortifications: [] },
  benchState: { pieces: [] },
  shopCards: [],
  synergies: [],
  battleResults: [],
  phase: 'preparation' as GamePhase,
  isReady: false,
}

export const useGameStore = create<GameState>()((set) => ({
  ...initialState,

  setUserId: (userId) => set({ userId }),
  setMatch: (match) => set({ match }),
  setMatchId: (matchId) => set({ matchId }),
  setPlayers: (players) => set({ players }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  setBoardState: (state) => set({ boardState: state }),
  setBenchState: (state) => set({ benchState: state }),
  setShopCards: (cards) => set({ shopCards: cards }),
  setSynergies: (synergies) => set({ synergies }),
  setPhase: (phase) => set({ phase }),
  setIsReady: (ready) => set({ isReady: ready }),

  addUnitToBench: (unit) =>
    set(
      produce((state: GameState) => {
        state.benchState.pieces.push(unit)
      })
    ),

  removeUnitFromBench: (unitId) =>
    set(
      produce((state: GameState) => {
        state.benchState.pieces = state.benchState.pieces.filter(
          (u) => u.id !== unitId
        )
      })
    ),

  placeUnitOnBoard: (unitId, x, y) =>
    set(
      produce((state: GameState) => {
        const unit = state.benchState.pieces.find((u) => u.id === unitId)
        if (unit) {
          unit.x = x
          unit.y = y
          state.boardState.pieces.push(unit)
          state.benchState.pieces = state.benchState.pieces.filter(
            (u) => u.id !== unitId
          )
        }
      })
    ),

  removeUnitFromBoard: (x, y) =>
    set(
      produce((state: GameState) => {
        const unit = state.boardState.pieces.find(
          (u) => u.x === x && u.y === y
        )
        if (unit) {
          delete unit.x
          delete unit.y
          state.benchState.pieces.push(unit)
          state.boardState.pieces = state.boardState.pieces.filter(
            (u) => !(u.x === x && u.y === y)
          )
        }
      })
    ),

  updateUnit: (unitId, updates) =>
    set(
      produce((state: GameState) => {
        const benchUnit = state.benchState.pieces.find((u) => u.id === unitId)
        if (benchUnit) {
          Object.assign(benchUnit, updates)
        }
        const boardUnit = state.boardState.pieces.find((u) => u.id === unitId)
        if (boardUnit) {
          Object.assign(boardUnit, updates)
        }
      })
    ),

  reset: () => set(initialState),
}))
