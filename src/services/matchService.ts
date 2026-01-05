import { insforge } from './insforge'
import { Match, Player, BoardState } from '../types/game'

export async function createMatch(hostId: string, hostName: string): Promise<string> {
  const { data: match, error: matchError } = await insforge.database
    .from('matches')
    .insert({
      status: 'waiting',
      phase: 'preparation',
      turn_number: 0,
      max_players: 8,
    })
    .select()
    .single()

  if (matchError || !match) {
    throw new Error('Failed to create match')
  }

  // Add host player
  await addPlayerToMatch(match.match_id, hostId, hostName, false)

  return match.match_id
}

export async function addPlayerToMatch(
  matchId: string,
  playerId: string,
  playerName: string,
  isBot: boolean
): Promise<void> {
  // Check if player already exists
  const { data: existing } = await insforge.database
    .from('match_players')
    .select()
    .eq('match_id', matchId)
    .eq('player_id', playerId)
    .maybeSingle()

  if (existing) return

  const { error } = await insforge.database
    .from('match_players')
    .insert({
      match_id: matchId,
      player_id: playerId,
      player_name: playerName,
      hp: 50,
      money: 5,
      level: 1,
      is_ready: false,
      is_bot: isBot,
      is_alive: true,
      win_streak: 0,
      lose_streak: 0,
      placement: 0,
    })

  if (error) {
    throw new Error('Failed to add player to match')
  }

  // Create initial board state
  await insforge.database
    .from('boards')
    .insert({
      match_id: matchId,
      player_id: playerId,
      board_state: { pieces: [], fortifications: [] },
      bench_state: { pieces: [] },
      active_synergies: [],
    })
}

export async function fillBots(matchId: string, count: number): Promise<void> {
  // Get current player count
  const { data: players } = await insforge.database
    .from('match_players')
    .select('player_id')
    .eq('match_id', matchId)

  const currentCount = players?.length || 0
  const needed = Math.min(count, 8 - currentCount)

  for (let i = 0; i < needed; i++) {
    const botId = `bot_${matchId}_${i}_${Date.now()}`
    const botName = `AI Bot ${i + 1}`
    await addPlayerToMatch(matchId, botId, botName, true)
  }
}

export async function startMatch(matchId: string): Promise<void> {
  // Fill remaining bots
  await fillBots(matchId, 8)

  // Update match status
  const { error } = await insforge.database
    .from('matches')
    .update({
      status: 'in_progress',
      phase: 'preparation',
      turn_number: 1,
    })
    .eq('match_id', matchId)

  if (error) {
    throw new Error('Failed to start match')
  }
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const { data, error } = await insforge.database
    .from('matches')
    .select()
    .eq('match_id', matchId)
    .single()

  if (error || !data) return null

  return {
    matchId: data.match_id,
    status: data.status,
    phase: data.phase,
    turnNumber: data.turn_number,
    maxPlayers: data.max_players,
    winnerId: data.winner_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function getPlayers(matchId: string): Promise<Player[]> {
  const { data, error } = await insforge.database
    .from('match_players')
    .select()
    .eq('match_id', matchId)
    .order('hp', { ascending: false })

  if (error || !data) return []

  return data.map(p => ({
    id: p.id,
    matchId: p.match_id,
    playerId: p.player_id,
    playerName: p.player_name,
    hp: p.hp,
    money: p.money,
    level: p.level,
    isReady: p.is_ready,
    isBot: p.is_bot,
    isAlive: p.is_alive,
    winStreak: p.win_streak,
    loseStreak: p.lose_streak,
    placement: p.placement,
    lastOpponentId: p.last_opponent_id,
  }))
}

export async function getBoardState(matchId: string, playerId: string): Promise<BoardState | null> {
  const { data, error } = await insforge.database
    .from('boards')
    .select()
    .eq('match_id', matchId)
    .eq('player_id', playerId)
    .single()

  if (error || !data) return null

  return {
    pieces: data.board_state?.pieces || [],
    fortifications: data.board_state?.fortifications || [],
  }
}

export async function updateBoardState(
  matchId: string,
  playerId: string,
  boardState: BoardState,
  benchState: { pieces: any[] },
  synergies: any[]
): Promise<void> {
  const { error } = await insforge.database
    .from('boards')
    .update({
      board_state: boardState,
      bench_state: benchState,
      active_synergies: synergies,
    })
    .eq('match_id', matchId)
    .eq('player_id', playerId)

  if (error) {
    throw new Error('Failed to update board state')
  }
}

export async function setPlayerReady(matchId: string, playerId: string, ready: boolean): Promise<void> {
  const { error } = await insforge.database
    .from('match_players')
    .update({ is_ready: ready })
    .eq('match_id', matchId)
    .eq('player_id', playerId)

  if (error) {
    throw new Error('Failed to set player ready')
  }
}

export async function updatePlayerStats(
  matchId: string,
  playerId: string,
  updates: Partial<Player>
): Promise<void> {
  const { error } = await insforge.database
    .from('match_players')
    .update({
      hp: updates.hp,
      money: updates.money,
      level: updates.level,
      win_streak: updates.winStreak,
      lose_streak: updates.loseStreak,
      is_alive: updates.isAlive,
      placement: updates.placement,
      last_opponent_id: updates.lastOpponentId,
    })
    .eq('match_id', matchId)
    .eq('player_id', playerId)

  if (error) {
    throw new Error('Failed to update player stats')
  }
}
