import { insforge } from './insforge'
import { Match, Player, BattleResult } from '../types/game'

export async function subscribeToMatch(matchId: string): Promise<void> {
  await insforge.realtime.connect()
  await insforge.realtime.subscribe(`match:${matchId}`)
  await insforge.realtime.subscribe(`players:${matchId}`)
  await insforge.realtime.subscribe(`game:${matchId}`)
}

export function onMatchUpdate(callback: (match: Match) => void): void {
  insforge.realtime.on('UPDATE_match', (payload: any) => {
    callback({
      matchId: String(payload.match_id || ''),
      status: String(payload.status || 'waiting') as Match['status'],
      phase: String(payload.phase || 'preparation') as Match['phase'],
      turnNumber: Number(payload.turn_number || 0),
      maxPlayers: Number(payload.max_players || 8),
      winnerId: payload.winner_id ? String(payload.winner_id) : undefined,
      createdAt: String(payload.created_at || ''),
      updatedAt: String(payload.updated_at || ''),
    })
  })
}

export function onPlayerUpdate(callback: (players: Player[]) => void): void {
  insforge.realtime.on('UPDATE_match_players', (_payload: any) => {
    // Need to refetch all players
    callback([]) // Placeholder, should refetch from payload or query
  })
}

export function onPhaseChange(callback: (phase: string) => void): void {
  insforge.realtime.on('phase_change', (payload: any) => {
    callback(String(payload.phase || 'preparation'))
  })
}

export function onBattleResults(callback: (result: BattleResult) => void): void {
  insforge.realtime.on('battle_results', (payload: any) => {
    // Convert payload to BattleResult format
    // Payload might be the result directly or wrapped in a results array
    let result: BattleResult | null = null
    
    if (payload && typeof payload === 'object') {
      if (payload.winnerId !== undefined) {
        // Direct result object
        result = {
          winnerId: String(payload.winnerId || ''),
          loserId: String(payload.loserId || ''),
          damage: Number(payload.damage || 0),
          events: Array.isArray(payload.events) ? payload.events : [],
        }
      } else if (Array.isArray(payload.results) && payload.results.length > 0) {
        // Wrapped in results array
        const firstResult = payload.results[0]
        result = {
          winnerId: String(firstResult.winnerId || ''),
          loserId: String(firstResult.loserId || ''),
          damage: Number(firstResult.damage || 0),
          events: Array.isArray(firstResult.events) ? firstResult.events : [],
        }
      }
    }
    
    if (result) {
      callback(result)
    }
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
