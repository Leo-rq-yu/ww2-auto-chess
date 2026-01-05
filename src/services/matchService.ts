import { v4 as uuidv4 } from 'uuid';
import insforge from './insforge';
import { MAX_PLAYERS, STARTING_HP, STARTING_MONEY } from '../types';

// =============================================
// Match Service - InsForge Database Operations
// =============================================

// Create a new match
export async function createMatch(creatorId: string, creatorName: string) {
  const matchId = uuidv4();
  
  const { data: match, error: matchError } = await insforge.database
    .from('matches')
    .insert({
      match_id: matchId,
      status: 'waiting',
      phase: 'preparation',
      turn_number: 0,
      max_players: MAX_PLAYERS,
    })
    .select()
    .single();

  if (matchError) throw matchError;

  // Add creator as first player
  await addPlayerToMatch(matchId, creatorId, creatorName, false);

  return match;
}

// Join an existing match
export async function joinMatch(matchId: string, playerId: string, playerName: string) {
  // Check if match exists and has room
  const { data: match, error: matchError } = await insforge.database
    .from('matches')
    .select('*, match_players(*)')
    .eq('match_id', matchId)
    .single();

  if (matchError) throw matchError;
  if (!match) throw new Error('Match not found');
  if (match.status !== 'waiting') throw new Error('Match already started');
  if (match.match_players.length >= MAX_PLAYERS) throw new Error('Match is full');

  await addPlayerToMatch(matchId, playerId, playerName, false);
  return match;
}

// Add a player (human or bot) to match
export async function addPlayerToMatch(
  matchId: string, 
  playerId: string, 
  playerName: string,
  isBot: boolean
) {
  // First ensure the player exists in the players table
  const { data: existingPlayers, error: checkError } = await insforge.database
    .from('players')
    .select('id')
    .eq('id', playerId);

  // If no existing player found (empty array or error), create one
  if (checkError || !existingPlayers || existingPlayers.length === 0) {
    // Create the player if they don't exist
    // Use a unique username by appending part of the playerId
    const uniqueUsername = `${playerName}#${playerId.slice(0, 8)}`;
    const { error: createError } = await insforge.database
      .from('players')
      .insert({
        id: playerId,
        username: uniqueUsername,
      });
    
    if (createError) {
      console.error('Failed to create player:', createError);
      throw createError;
    }
  }

  // Create match_player entry
  const { error: playerError } = await insforge.database
    .from('match_players')
    .insert({
      match_id: matchId,
      player_id: playerId,
      player_name: playerName,
      hp: STARTING_HP,
      money: STARTING_MONEY,
      level: 1,
      is_ready: false,
      is_bot: isBot,
      is_alive: true,
    });

  if (playerError) throw playerError;

  // Create board state
  const { error: boardError } = await insforge.database
    .from('boards')
    .insert({
      match_id: matchId,
      player_id: playerId,
      board_state: {},
      bench_state: [],
      active_synergies: [],
    });

  if (boardError) throw boardError;

  // Create shop state
  const { error: shopError } = await insforge.database
    .from('shop_cards')
    .insert({
      match_id: matchId,
      player_id: playerId,
      cards: [],
      refresh_cost: 2,
    });

  if (shopError) throw shopError;
}

// Fill empty slots with bots
export async function fillWithBots(matchId: string) {
  const { data: match, error } = await insforge.database
    .from('matches')
    .select('*, match_players(*)')
    .eq('match_id', matchId)
    .single();

  if (error) throw error;

  const currentPlayerCount = match.match_players.length;
  const botsNeeded = MAX_PLAYERS - currentPlayerCount;

  const botNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
  
  for (let i = 0; i < botsNeeded; i++) {
    const botId = uuidv4();
    const botName = `Bot ${botNames[i % botNames.length]}`;
    
    // addPlayerToMatch will create the player if needed
    await addPlayerToMatch(matchId, botId, botName, true);
  }
}

// Get match data
export async function getMatch(matchId: string) {
  const { data, error } = await insforge.database
    .from('matches')
    .select('*, match_players(*)')
    .eq('match_id', matchId)
    .single();

  if (error) throw error;
  return data;
}

// Get all waiting matches
export async function getWaitingMatches() {
  const { data, error } = await insforge.database
    .from('matches')
    .select('*, match_players(count)')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// Update match status
export async function updateMatchStatus(matchId: string, status: string, phase?: string) {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (phase) updates.phase = phase;

  const { error } = await insforge.database
    .from('matches')
    .update(updates)
    .eq('match_id', matchId);

  if (error) throw error;
}

// Update match turn
export async function updateMatchTurn(matchId: string, turnNumber: number, phase: string) {
  const { error } = await insforge.database
    .from('matches')
    .update({
      turn_number: turnNumber,
      phase,
      updated_at: new Date().toISOString(),
    })
    .eq('match_id', matchId);

  if (error) throw error;
}

// Set match winner
export async function setMatchWinner(matchId: string, winnerId: string) {
  const { error } = await insforge.database
    .from('matches')
    .update({
      winner_id: winnerId,
      status: 'finished',
      updated_at: new Date().toISOString(),
    })
    .eq('match_id', matchId);

  if (error) throw error;
}

// Update player ready status
export async function setPlayerReady(matchId: string, playerId: string, isReady: boolean) {
  const { error } = await insforge.database
    .from('match_players')
    .update({ is_ready: isReady, updated_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .eq('player_id', playerId);

  if (error) throw error;
}

// Check if all players are ready
export async function areAllPlayersReady(matchId: string): Promise<boolean> {
  const { data, error } = await insforge.database
    .from('match_players')
    .select('is_ready')
    .eq('match_id', matchId)
    .eq('is_alive', true);

  if (error) throw error;
  return data?.every(p => p.is_ready) ?? false;
}

// Update player stats after battle
export async function updatePlayerStats(
  matchId: string,
  playerId: string,
  hp: number,
  money: number,
  winStreak: number,
  loseStreak: number,
  lastOpponentId?: string
) {
  const updates: Record<string, unknown> = {
    hp,
    money,
    win_streak: winStreak,
    lose_streak: loseStreak,
    is_alive: hp > 0,
    updated_at: new Date().toISOString(),
  };
  
  if (lastOpponentId) {
    updates.last_opponent_id = lastOpponentId;
  }

  const { error } = await insforge.database
    .from('match_players')
    .update(updates)
    .eq('match_id', matchId)
    .eq('player_id', playerId);

  if (error) throw error;
}

// Update player money
export async function updatePlayerMoney(matchId: string, playerId: string, money: number) {
  const { error } = await insforge.database
    .from('match_players')
    .update({ money, updated_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .eq('player_id', playerId);

  if (error) throw error;
}

// Get alive players in a match
export async function getAlivePlayers(matchId: string) {
  const { data, error } = await insforge.database
    .from('match_players')
    .select('*')
    .eq('match_id', matchId)
    .eq('is_alive', true)
    .order('hp', { ascending: false });

  if (error) throw error;
  return data;
}

// Update board state
export async function updateBoardState(
  matchId: string,
  playerId: string,
  boardState: Record<string, unknown>,
  benchState: unknown[]
) {
  const { error } = await insforge.database
    .from('boards')
    .update({
      board_state: boardState,
      bench_state: benchState,
      updated_at: new Date().toISOString(),
    })
    .eq('match_id', matchId)
    .eq('player_id', playerId);

  if (error) throw error;
}

// Get player board
export async function getPlayerBoard(matchId: string, playerId: string) {
  const { data, error } = await insforge.database
    .from('boards')
    .select('*')
    .eq('match_id', matchId)
    .eq('player_id', playerId)
    .single();

  if (error) throw error;
  return data;
}

// Get all player boards for a match
export async function getPlayerBoards(matchId: string): Promise<Array<{
  playerId: string;
  boardState: Record<string, unknown>;
  benchState: unknown[];
}>> {
  const { data, error } = await insforge.database
    .from('boards')
    .select('player_id, board_state, bench_state')
    .eq('match_id', matchId);

  if (error) throw error;
  
  return (data || []).map(row => ({
    playerId: row.player_id,
    boardState: row.board_state || {},
    benchState: row.bench_state || [],
  }));
}

// Update shop cards
export async function updateShopCards(matchId: string, playerId: string, cards: unknown[]) {
  const { error } = await insforge.database
    .from('shop_cards')
    .update({ cards, updated_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .eq('player_id', playerId);

  if (error) throw error;
}

// Get player shop
export async function getPlayerShop(matchId: string, playerId: string) {
  const { data, error } = await insforge.database
    .from('shop_cards')
    .select('*')
    .eq('match_id', matchId)
    .eq('player_id', playerId)
    .single();

  if (error) throw error;
  return data;
}

// Update match phase
export async function updateMatchPhase(matchId: string, phase: string, turnNumber: number) {
  const { error } = await insforge.database
    .from('matches')
    .update({
      phase,
      turn_number: turnNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('match_id', matchId);

  if (error) throw error;
}

// Get match players
export async function getMatchPlayers(matchId: string) {
  const { data, error } = await insforge.database
    .from('match_players')
    .select('*')
    .eq('match_id', matchId)
    .order('hp', { ascending: false });

  if (error) throw error;
  return data;
}

// Update player state (multiple fields)
export async function updatePlayerState(
  matchId: string,
  playerId: string,
  updates: Record<string, unknown>
) {
  const { error } = await insforge.database
    .from('match_players')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .eq('player_id', playerId);

  if (error) throw error;
}

