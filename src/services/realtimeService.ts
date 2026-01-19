import insforge from './insforge';

// =============================================
// Realtime Service - WebSocket Subscriptions
// =============================================

export interface MatchUpdatePayload {
  match_id: string;
  status: string;
  phase: string;
  turn_number: number;
  winner_id?: string;
}

export interface PlayerUpdatePayload {
  id: string;
  match_id: string;
  player_id: string;
  player_name: string;
  hp: number;
  money: number;
  level: number;
  is_ready: boolean;
  is_alive: boolean;
  is_bot: boolean;
  placement?: number;
  win_streak: number;
  lose_streak: number;
}

export interface BoardUpdatePayload {
  id: string;
  match_id: string;
  player_id: string;
  board_state: Record<string, unknown>;
  bench_state: unknown[];
  active_synergies: unknown[];
}

export interface ShopUpdatePayload {
  id: string;
  match_id: string;
  player_id: string;
  cards: unknown[];
  refresh_cost: number;
}

// Event callback types
type MatchUpdateHandler = (payload: MatchUpdatePayload) => void;
type PlayerUpdateHandler = (payload: PlayerUpdatePayload) => void;
type BoardUpdateHandler = (payload: BoardUpdatePayload) => void;
type ShopUpdateHandler = (payload: ShopUpdatePayload) => void;
type PhaseChangeHandler = (phase: string, turnNumber: number) => void;
type AllPlayersReadyHandler = () => void;
type BattleStartHandler = (pairings: { player1Id: string; player2Id: string }[]) => void;
type BattleResultHandler = (result: unknown) => void;
type BattleResultsHandler = (results: BattleResultsPayload) => void;

export interface BattleResultsPayload {
  match_id: string;
  results: Array<{
    player1Id: string;
    player2Id: string;
    result: {
      winnerId: string | null;
      loserId: string | null;
      winnerSurvivors: number;
      loserSurvivors: number;
      damageDealt: number;
      isDraw: boolean;
    };
    events: Array<{
      turn: number;
      type: string;
      pieceId: string;
      targetId?: string;
      from?: { x: number; y: number };
      to?: { x: number; y: number };
      damage?: number;
    }>;
    finalBoard: {
      pieces: Record<string, unknown>;
      piecePositions: Record<string, string>;
    };
  }>;
  timestamp: number;
}
type PlayerReadyHandler = (playerId: string, isReady: boolean, isBot: boolean) => void;
type BotActionHandler = (botId: string, action: unknown) => void;

class RealtimeService {
  private connected = false;
  private subscribedChannels: Set<string> = new Set();

  // Event handlers
  private matchHandlers: Map<string, MatchUpdateHandler[]> = new Map();
  private playerHandlers: Map<string, PlayerUpdateHandler[]> = new Map();
  private boardHandlers: Map<string, BoardUpdateHandler[]> = new Map();
  private shopHandlers: Map<string, ShopUpdateHandler[]> = new Map();
  private phaseChangeHandlers: Map<string, PhaseChangeHandler[]> = new Map();
  private readyHandlers: Map<string, AllPlayersReadyHandler[]> = new Map();
  private battleStartHandlers: Map<string, BattleStartHandler[]> = new Map();
  private battleResultHandlers: Map<string, BattleResultHandler[]> = new Map();
  private playerReadyHandlers: Map<string, PlayerReadyHandler[]> = new Map();
  private botActionHandlers: Map<string, BotActionHandler[]> = new Map();
  private battleResultsHandlers: Map<string, BattleResultsHandler[]> = new Map();

  async connect() {
    if (this.connected) return;

    try {
      await insforge.realtime.connect();
      this.connected = true;
      console.log('[Realtime] Connected');

      // Set up connection event handlers
      insforge.realtime.on('disconnect', reason => {
        console.log('[Realtime] Disconnected:', reason);
        this.connected = false;
      });

      insforge.realtime.on('connect_error', err => {
        console.error('[Realtime] Connection error:', err);
      });

      insforge.realtime.on('error', ({ code, message }) => {
        console.error('[Realtime] Error:', code, message);
      });
    } catch (error) {
      console.error('[Realtime] Failed to connect:', error);
      throw error;
    }
  }

  async disconnect() {
    if (!this.connected) return;

    insforge.realtime.disconnect();
    this.connected = false;
    this.subscribedChannels.clear();
    this.clearAllHandlers();
    console.log('[Realtime] Disconnected');
  }

  private clearAllHandlers() {
    this.matchHandlers.clear();
    this.playerHandlers.clear();
    this.boardHandlers.clear();
    this.shopHandlers.clear();
    this.phaseChangeHandlers.clear();
    this.readyHandlers.clear();
    this.battleStartHandlers.clear();
    this.battleResultHandlers.clear();
    this.playerReadyHandlers.clear();
    this.botActionHandlers.clear();
    this.battleResultsHandlers.clear();
  }

  // ==========================================
  // Subscribe to Match Updates
  // ==========================================
  async subscribeToMatch(matchId: string, handler: MatchUpdateHandler) {
    await this.connect();

    const channel = `match:${matchId}`;

    if (!this.subscribedChannels.has(channel)) {
      const result = await insforge.realtime.subscribe(channel);
      if (!result.ok) {
        console.error('[Realtime] Failed to subscribe to match:', result.error);
        return;
      }
      this.subscribedChannels.add(channel);
      console.log('[Realtime] Subscribed to:', channel);
    }

    // Store handler
    if (!this.matchHandlers.has(matchId)) {
      this.matchHandlers.set(matchId, []);
    }
    this.matchHandlers.get(matchId)!.push(handler);

    // Listen for database-triggered events
    insforge.realtime.on('INSERT_match', (payload: MatchUpdatePayload) => {
      if (payload.match_id === matchId) {
        this.matchHandlers.get(matchId)?.forEach(h => h(payload));
      }
    });

    insforge.realtime.on('UPDATE_match', (payload: MatchUpdatePayload) => {
      if (payload.match_id === matchId) {
        this.matchHandlers.get(matchId)?.forEach(h => h(payload));
      }
    });

    // Listen for custom phase change events
    insforge.realtime.on(
      'phase_change',
      (payload: { match_id: string; phase: string; turn_number: number }) => {
        if (payload.match_id === matchId) {
          this.phaseChangeHandlers
            .get(matchId)
            ?.forEach(h => h(payload.phase, payload.turn_number));
        }
      }
    );

    // Listen for all players ready event
    insforge.realtime.on('all_players_ready', (payload: { match_id: string }) => {
      if (payload.match_id === matchId) {
        this.readyHandlers.get(matchId)?.forEach(h => h());
      }
    });

    // Listen for battle start event
    insforge.realtime.on(
      'battle_start',
      (payload: { match_id: string; pairings: { player1Id: string; player2Id: string }[] }) => {
        if (payload.match_id === matchId) {
          this.battleStartHandlers.get(matchId)?.forEach(h => h(payload.pairings));
        }
      }
    );

    // Listen for battle result event
    insforge.realtime.on('battle_result', (payload: { match_id: string; result: unknown }) => {
      if (payload.match_id === matchId) {
        this.battleResultHandlers.get(matchId)?.forEach(h => h(payload.result));
      }
    });

    // Listen for player ready event (from humans and bots)
    insforge.realtime.on(
      'player_ready',
      (payload: {
        match_id?: string;
        player_id?: string;
        is_ready?: boolean;
        isBot?: boolean;
        is_bot?: boolean;
      }) => {
        const targetMatchId = payload.match_id || matchId;
        const playerId = payload.player_id;
        const isReady = payload.is_ready ?? false;
        const isBot = payload.is_bot ?? payload.isBot ?? false;

        if (targetMatchId === matchId && playerId) {
          this.playerReadyHandlers.get(matchId)?.forEach(h => h(playerId, isReady, isBot));
        }
      }
    );

    // Listen for bot action events
    insforge.realtime.on(
      'bot_action',
      (payload: {
        match_id?: string;
        botId: string;
        actionType: string;
        [key: string]: unknown;
      }) => {
        const targetMatchId = payload.match_id || matchId;
        if (targetMatchId === matchId) {
          this.botActionHandlers.get(matchId)?.forEach(h => h(payload.botId, payload));
        }
      }
    );

    // Listen for battle results from Edge Function
    insforge.realtime.on('battle_results', (payload: BattleResultsPayload) => {
      if (payload.match_id === matchId) {
        console.log('[Realtime] Received battle_results:', payload);
        this.battleResultsHandlers.get(matchId)?.forEach(h => h(payload));
      }
    });
  }

  // ==========================================
  // Subscribe to Player Updates
  // ==========================================
  async subscribeToPlayers(matchId: string, handler: PlayerUpdateHandler) {
    await this.connect();

    const channel = `players:${matchId}`;

    if (!this.subscribedChannels.has(channel)) {
      const result = await insforge.realtime.subscribe(channel);
      if (!result.ok) {
        console.error('[Realtime] Failed to subscribe to players:', result.error);
        return;
      }
      this.subscribedChannels.add(channel);
      console.log('[Realtime] Subscribed to:', channel);
    }

    if (!this.playerHandlers.has(matchId)) {
      this.playerHandlers.set(matchId, []);
    }
    this.playerHandlers.get(matchId)!.push(handler);

    // Listen for database-triggered events
    insforge.realtime.on('INSERT_player', (payload: PlayerUpdatePayload) => {
      if (payload.match_id === matchId) {
        this.playerHandlers.get(matchId)?.forEach(h => h(payload));
      }
    });

    insforge.realtime.on('UPDATE_player', (payload: PlayerUpdatePayload) => {
      if (payload.match_id === matchId) {
        this.playerHandlers.get(matchId)?.forEach(h => h(payload));
      }
    });
  }

  // ==========================================
  // Subscribe to Board Updates
  // ==========================================
  async subscribeToBoard(matchId: string, playerId: string, handler: BoardUpdateHandler) {
    await this.connect();

    const channel = `board:${matchId}:${playerId}`;

    if (!this.subscribedChannels.has(channel)) {
      const result = await insforge.realtime.subscribe(channel);
      if (!result.ok) {
        console.error('[Realtime] Failed to subscribe to board:', result.error);
        return;
      }
      this.subscribedChannels.add(channel);
      console.log('[Realtime] Subscribed to:', channel);
    }

    const key = `${matchId}:${playerId}`;
    if (!this.boardHandlers.has(key)) {
      this.boardHandlers.set(key, []);
    }
    this.boardHandlers.get(key)!.push(handler);

    // Listen for database-triggered events
    insforge.realtime.on('INSERT_board', (payload: BoardUpdatePayload) => {
      if (payload.match_id === matchId && payload.player_id === playerId) {
        this.boardHandlers.get(key)?.forEach(h => h(payload));
      }
    });

    insforge.realtime.on('UPDATE_board', (payload: BoardUpdatePayload) => {
      if (payload.match_id === matchId && payload.player_id === playerId) {
        this.boardHandlers.get(key)?.forEach(h => h(payload));
      }
    });
  }

  // ==========================================
  // Subscribe to Shop Updates
  // ==========================================
  async subscribeToShop(matchId: string, playerId: string, handler: ShopUpdateHandler) {
    await this.connect();

    const channel = `shop:${matchId}:${playerId}`;

    if (!this.subscribedChannels.has(channel)) {
      const result = await insforge.realtime.subscribe(channel);
      if (!result.ok) {
        console.error('[Realtime] Failed to subscribe to shop:', result.error);
        return;
      }
      this.subscribedChannels.add(channel);
      console.log('[Realtime] Subscribed to:', channel);
    }

    const key = `${matchId}:${playerId}`;
    if (!this.shopHandlers.has(key)) {
      this.shopHandlers.set(key, []);
    }
    this.shopHandlers.get(key)!.push(handler);

    // Listen for database-triggered events
    insforge.realtime.on('INSERT_shop', (payload: ShopUpdatePayload) => {
      if (payload.match_id === matchId && payload.player_id === playerId) {
        this.shopHandlers.get(key)?.forEach(h => h(payload));
      }
    });

    insforge.realtime.on('UPDATE_shop', (payload: ShopUpdatePayload) => {
      if (payload.match_id === matchId && payload.player_id === playerId) {
        this.shopHandlers.get(key)?.forEach(h => h(payload));
      }
    });
  }

  // ==========================================
  // Event Subscriptions for Custom Events
  // ==========================================
  onPhaseChange(matchId: string, handler: PhaseChangeHandler) {
    if (!this.phaseChangeHandlers.has(matchId)) {
      this.phaseChangeHandlers.set(matchId, []);
    }
    this.phaseChangeHandlers.get(matchId)!.push(handler);
  }

  onAllPlayersReady(matchId: string, handler: AllPlayersReadyHandler) {
    if (!this.readyHandlers.has(matchId)) {
      this.readyHandlers.set(matchId, []);
    }
    this.readyHandlers.get(matchId)!.push(handler);
  }

  onBattleStart(matchId: string, handler: BattleStartHandler) {
    if (!this.battleStartHandlers.has(matchId)) {
      this.battleStartHandlers.set(matchId, []);
    }
    this.battleStartHandlers.get(matchId)!.push(handler);
  }

  onBattleResult(matchId: string, handler: BattleResultHandler) {
    if (!this.battleResultHandlers.has(matchId)) {
      this.battleResultHandlers.set(matchId, []);
    }
    this.battleResultHandlers.get(matchId)!.push(handler);
  }

  onPlayerReady(matchId: string, handler: PlayerReadyHandler) {
    if (!this.playerReadyHandlers.has(matchId)) {
      this.playerReadyHandlers.set(matchId, []);
    }
    this.playerReadyHandlers.get(matchId)!.push(handler);
  }

  onBotAction(matchId: string, handler: BotActionHandler) {
    if (!this.botActionHandlers.has(matchId)) {
      this.botActionHandlers.set(matchId, []);
    }
    this.botActionHandlers.get(matchId)!.push(handler);
  }

  onBattleResults(matchId: string, handler: BattleResultsHandler) {
    if (!this.battleResultsHandlers.has(matchId)) {
      this.battleResultsHandlers.set(matchId, []);
    }
    this.battleResultsHandlers.get(matchId)!.push(handler);
  }

  // ==========================================
  // Publish Events
  // ==========================================
  async publishPlayerReady(matchId: string, playerId: string, isReady: boolean) {
    const channel = `match:${matchId}`;
    await insforge.realtime.publish(channel, 'player_ready', {
      match_id: matchId,
      player_id: playerId,
      is_ready: isReady,
    });
  }

  async publishPhaseChange(matchId: string, phase: string, turnNumber: number) {
    const channel = `match:${matchId}`;
    await insforge.realtime.publish(channel, 'phase_change', {
      match_id: matchId,
      phase,
      turn_number: turnNumber,
    });
  }

  async publishAllPlayersReady(matchId: string) {
    const channel = `match:${matchId}`;
    await insforge.realtime.publish(channel, 'all_players_ready', {
      match_id: matchId,
    });
  }

  async publishBattleStart(matchId: string, pairings: { player1Id: string; player2Id: string }[]) {
    const channel = `match:${matchId}`;
    await insforge.realtime.publish(channel, 'battle_start', {
      match_id: matchId,
      pairings,
    });
  }

  async publishBattleResult(matchId: string, result: unknown) {
    const channel = `match:${matchId}`;
    await insforge.realtime.publish(channel, 'battle_result', {
      match_id: matchId,
      result,
    });
  }

  async publishBattleResults(matchId: string, results: BattleResultsPayload['results']) {
    const channel = `match:${matchId}`;
    const payload: BattleResultsPayload = {
      match_id: matchId,
      results,
      timestamp: Date.now(),
    };
    console.log('[Realtime] Publishing battle results:', payload);
    await insforge.realtime.publish(channel, 'battle_results', payload);
  }

  async publishBoardUpdate(
    matchId: string,
    playerId: string,
    boardState: unknown,
    benchState: unknown
  ) {
    const channel = `board:${matchId}:${playerId}`;
    await insforge.realtime.publish(channel, 'board_update', {
      match_id: matchId,
      player_id: playerId,
      board_state: boardState,
      bench_state: benchState,
    });
  }

  // ==========================================
  // Unsubscribe
  // ==========================================
  unsubscribeFromMatch(matchId: string) {
    const matchChannel = `match:${matchId}`;
    const playersChannel = `players:${matchId}`;

    if (this.subscribedChannels.has(matchChannel)) {
      insforge.realtime.unsubscribe(matchChannel);
      this.subscribedChannels.delete(matchChannel);
    }

    if (this.subscribedChannels.has(playersChannel)) {
      insforge.realtime.unsubscribe(playersChannel);
      this.subscribedChannels.delete(playersChannel);
    }

    // Clear handlers
    this.matchHandlers.delete(matchId);
    this.playerHandlers.delete(matchId);
    this.phaseChangeHandlers.delete(matchId);
    this.readyHandlers.delete(matchId);
    this.battleStartHandlers.delete(matchId);
    this.battleResultHandlers.delete(matchId);
    this.playerReadyHandlers.delete(matchId);
    this.botActionHandlers.delete(matchId);
    this.battleResultsHandlers.delete(matchId);

    console.log('[Realtime] Unsubscribed from match:', matchId);
  }

  unsubscribeFromBoard(matchId: string, playerId: string) {
    const channel = `board:${matchId}:${playerId}`;
    if (this.subscribedChannels.has(channel)) {
      insforge.realtime.unsubscribe(channel);
      this.subscribedChannels.delete(channel);
    }
    this.boardHandlers.delete(`${matchId}:${playerId}`);
  }

  unsubscribeFromShop(matchId: string, playerId: string) {
    const channel = `shop:${matchId}:${playerId}`;
    if (this.subscribedChannels.has(channel)) {
      insforge.realtime.unsubscribe(channel);
      this.subscribedChannels.delete(channel);
    }
    this.shopHandlers.delete(`${matchId}:${playerId}`);
  }

  // ==========================================
  // Status
  // ==========================================
  isConnected() {
    return this.connected && insforge.realtime.isConnected;
  }

  getSubscribedChannels() {
    return Array.from(this.subscribedChannels);
  }
}

export const realtimeService = new RealtimeService();
export default realtimeService;
