import { Unit, Fortification } from './units'

export type GamePhase = 'preparation' | 'battle' | 'settlement'
export type MatchStatus = 'waiting' | 'in_progress' | 'finished'

export interface Player {
  id: string
  matchId: string
  playerId: string
  playerName: string
  hp: number
  money: number
  level: number
  isReady: boolean
  isBot: boolean
  isAlive: boolean
  winStreak: number
  loseStreak: number
  placement: number
  lastOpponentId?: string
}

export interface BoardState {
  pieces: Unit[]
  fortifications: Fortification[]
}

export interface Match {
  matchId: string
  status: MatchStatus
  phase: GamePhase
  turnNumber: number
  maxPlayers: number
  winnerId?: string
  createdAt: string
  updatedAt: string
}

export interface BattleResult {
  winnerId: string
  loserId: string
  damage: number
  events: BattleEvent[]
}

export interface BattleEvent {
  type: 'move' | 'attack' | 'death' | 'fortification'
  unitId?: string
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  targetId?: string
  damage?: number
  fortificationId?: string
  message: string
}

export interface ShopCard {
  unitType: string
  cost: number
}
