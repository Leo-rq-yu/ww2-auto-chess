import { insforge } from './insforge'
import { Match, Player, BattleResult } from '../types/game'

export async function subscribeToMatch(matchId: string): Promise<void> {
  await insforge.realtime.connect()
  await insforge.realtime.subscribe(`match:${matchId}`)
  await insforge.realtime.subscribe(`players:${matchId}`)
  await insforge.realtime.subscribe(`game:${matchId}`)
}

export function onMatchUpdate(callback: (match: Match) => void): void {
  insforge.realtime.on('UPDATE_match', (payload) => {
    callback({
      matchId: payload.match_id,
      status: payload.status,
      phase: payload.phase,
      turnNumber: payload.turn_number,
      maxPlayers: payload.max_players,
      winnerId: payload.winner_id,
      createdAt: payload.created_at,
      updatedAt: payload.updated_at,
    })
  })
}

export function onPlayerUpdate(callback: (players: Player[]) => void): void {
  insforge.realtime.on('UPDATE_match_players', (payload) => {
    // Need to refetch all players
    callback([]) // Placeholder, should refetch from payload or query
  })
}

export function onPhaseChange(callback: (phase: string) => void): void {
  insforge.realtime.on('phase_change', (payload) => {
    callback(payload.phase)
  })
}

export function onBattleResults(callback: (result: BattleResult) => void): void {
  insforge.realtime.on('battle_results', (payload) => {
    callback(payload)
  })
}

export async function publishPlayerReady(matchId: string, playerId: string, ready: boolean): Promise<void> {
  await insforge.realtime.publish(`game:${matchId}`, 'player_ready', {
    playerId,
    ready,
  })
}

export async function publishPhaseChange(matchId: string, phase: string): Promise<void> {
  await insforge.realtime.publish(`game:${matchId}`, 'phase_change', {
    phase,
  })
}

export async function publishBattleResults(matchId: string, results: BattleResult[]): Promise<void> {
  await insforge.realtime.publish(`game:${matchId}`, 'battle_results', {
    results,
  })
}

export function unsubscribeFromMatch(matchId: string): void {
  insforge.realtime.unsubscribe(`match:${matchId}`)
  insforge.realtime.unsubscribe(`players:${matchId}`)
  insforge.realtime.unsubscribe(`game:${matchId}`)
}
