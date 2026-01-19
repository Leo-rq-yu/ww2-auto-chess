import { useEffect, useCallback, useRef } from 'react';
import useGameStore from '../store/gameStore';
import { realtimeService } from '../services/realtimeService';
import { updateMatchPhase, getPlayerBoards, getMatchPlayers } from '../services/matchService';
import insforge from '../services/insforge';
import { Player, BoardState, BattleResult, Piece, BASE_INCOME, GamePhase } from '../types';
import { applyBattleResultToBot, getBotIds } from '../services/botService';

// =============================================
// Game Flow Hook - Manages game phases and battles
// Uses Realtime subscriptions instead of polling!
// =============================================

// Track ready status locally
interface ReadyTracker {
  players: Map<string, { isReady: boolean; isBot: boolean }>;
  totalPlayers: number;
}

// =============================================
// Helper Functions (outside hook for hoisting)
// =============================================

// Generate battle pairings
function generatePairings(alivePlayers: Player[]): { player1Id: string; player2Id: string }[] {
  const shuffled = [...alivePlayers].sort(() => Math.random() - 0.5);
  const pairings: { player1Id: string; player2Id: string }[] = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      pairings.push({
        player1Id: shuffled[i].id,
        player2Id: shuffled[i + 1].id,
      });
    } else {
      // Odd player - fight against ghost (clone of random opponent)
      const randomOpponent = shuffled[Math.floor(Math.random() * (shuffled.length - 1))];
      pairings.push({
        player1Id: shuffled[i].id,
        player2Id: randomOpponent.id,
      });
    }
  }

  return pairings;
}

// Create battle board from two player boards
function createBattleBoardFromTwo(
  player1Board: BoardState,
  player1Id: string,
  player2Board: BoardState,
  player2Id: string
): BoardState {
  const battleBoard: BoardState = {
    pieces: {},
    piecePositions: {},
    size: { width: 6, height: 6 },
  };

  // Add player 1's pieces (keep positions)
  Object.values(player1Board.pieces).forEach(piece => {
    if (piece.position && (piece.currentHp || 100) > 0) {
      const newPiece: Piece = {
        ...piece,
        ownerId: player1Id,
        currentHp: piece.currentHp || 100,
      };
      battleBoard.pieces[piece.id] = newPiece;
      battleBoard.piecePositions[`${piece.position.x},${piece.position.y}`] = piece.id;
    }
  });

  // Add player 2's pieces (mirror positions)
  Object.values(player2Board.pieces).forEach(piece => {
    if (piece.position && (piece.currentHp || 100) > 0) {
      const mirroredPos = {
        x: 5 - piece.position.x,
        y: 5 - piece.position.y,
      };
      const newId = `p2-${piece.id}`;
      const newPiece: Piece = {
        ...piece,
        id: newId,
        ownerId: player2Id,
        position: mirroredPos,
        currentHp: piece.currentHp || 100,
      };
      battleBoard.pieces[newId] = newPiece;
      battleBoard.piecePositions[`${mirroredPos.x},${mirroredPos.y}`] = newId;
    }
  });

  return battleBoard;
}

// =============================================
// Main Hook
// =============================================

export function useGameFlow(matchId: string | null, currentUserId: string | null) {
  const {
    players,
    turnNumber,
    setPhase,
    setTurnNumber,
    setBattleState,
    setBattleResult,
    clearBattle,
    applyBattleResult,
    updatePlayerStats,
  } = useGameStore();

  const readyTrackerRef = useRef<ReadyTracker>({ players: new Map(), totalPlayers: 0 });
  const currentOpponentRef = useRef<Player | null>(null);
  const battleStartedRef = useRef(false);
  const battleResultsProcessedRef = useRef(false);
  const listenersSetupRef = useRef(false);

  // Check if all players are ready (local check, no database call!)
  const checkAllPlayersReadyLocal = useCallback(() => {
    const tracker = readyTrackerRef.current;

    if (tracker.totalPlayers === 0) {
      console.log('[GameFlow] No players in tracker');
      return false;
    }

    const readyCount = Array.from(tracker.players.values()).filter(p => p.isReady).length;
    const allReady = readyCount === tracker.totalPlayers;

    console.log('[GameFlow] Ready check:', {
      readyCount,
      totalPlayers: tracker.totalPlayers,
      allReady,
      players: Array.from(tracker.players.entries()).map(([id, status]) => ({
        id: id ? id.slice(0, 8) : 'unknown',
        ...status,
      })),
    });

    return allReady;
  }, []);

  // Run battle turn by turn with Edge Function
  const runBattleTurnByTurn = useCallback(
    async (
      battleMatchId: string,
      initialBoard: BoardState,
      player1Id: string,
      player2Id: string
    ) => {
      let currentBoard = initialBoard;
      let turn = 0;
      const maxTurns = 30;
      const turnDelay = 500; // ms between turns for animation

      console.log('[GameFlow] Starting turn-by-turn battle');

      while (turn < maxTurns) {
        turn++;

        try {
          const { data, error } = await insforge.functions.invoke('run-battle', {
            body: {
              matchId: battleMatchId,
              turn,
              battleBoard: currentBoard,
              player1Id,
              player2Id,
            },
          });

          if (error) {
            console.error(`[GameFlow] Turn ${turn} error:`, error);
            break;
          }

          if (!data?.success) {
            console.error(`[GameFlow] Turn ${turn} failed:`, data);
            break;
          }

          // Update board for next turn
          currentBoard = data.updatedBoard;

          // Update UI with current state
          const opponent = currentOpponentRef.current;
          if (opponent) {
            setBattleState(currentBoard as BoardState, opponent);
          }

          console.log(`[GameFlow] Turn ${turn}: ${data.events?.length || 0} events`);

          // Check if battle is finished
          if (data.isFinished) {
            console.log('[GameFlow] Battle finished!', data.result);

            // Apply result
            if (data.result) {
              const result: BattleResult = {
                ...data.result,
                player1Id,
                player2Id,
              };
              setBattleResult(result);
              
              // Mark as processed BEFORE applying to prevent double-processing
              // when we receive our own published results via realtime subscription
              battleResultsProcessedRef.current = true;
              applyBattleResult(result);

              // Apply results to bots that participated
              const botIds = getBotIds(battleMatchId);
              [player1Id, player2Id].forEach(playerId => {
                if (botIds.includes(playerId)) {
                  const isWinner = result.winnerId === playerId;
                  const damage = isWinner ? 0 : result.damageDealt;
                  // Bots get base income + win bonus
                  const income = BASE_INCOME + (isWinner ? 1 : 0);
                  applyBattleResultToBot(battleMatchId, playerId, damage, isWinner, income);
                  console.log(
                    `[GameFlow] Applied battle result to bot ${playerId.slice(0, 8)}: won=${isWinner}, income=${income}`
                  );
                }
              });

              // Publish results for other clients
              await realtimeService.publishBattleResults(battleMatchId, [
                {
                  player1Id,
                  player2Id,
                  result,
                  events: [],
                  finalBoard: currentBoard,
                },
              ]);
            }
            break;
          }

          // Wait before next turn (for animation)
          await new Promise(resolve => setTimeout(resolve, turnDelay));
        } catch (err) {
          console.error(`[GameFlow] Turn ${turn} exception:`, err);
          break;
        }
      }

      // Transition to settlement phase after battle
      setTimeout(async () => {
        clearBattle();
        setPhase('settlement');

        setTimeout(async () => {
          battleStartedRef.current = false;
          battleResultsProcessedRef.current = false;

          const newTurn = useGameStore.getState().turnNumber + 1;
          setTurnNumber(newTurn);
          setPhase('preparation');

          // Reset ALL players' ready status (both bots and humans)
          readyTrackerRef.current.players.forEach((status, playerId) => {
            status.isReady = false;
            // Update UI to show not ready
            updatePlayerStats(playerId, { isReady: false });
          });

          // CRITICAL: Publish phase change via Realtime so bots hear about new round!
          if (battleMatchId) {
            console.log('[GameFlow] Publishing phase change to preparation, turn:', newTurn);
            await realtimeService.publishPhaseChange(battleMatchId, 'preparation', newTurn);
          }
        }, 2000);
      }, 2000);
    },
    [
      setBattleState,
      setBattleResult,
      applyBattleResult,
      clearBattle,
      setPhase,
      setTurnNumber,
      updatePlayerStats,
    ]
  );

  // Start the battle phase - now calls Edge Function instead of local simulation
  const startBattlePhase = useCallback(async () => {
    if (!matchId || !currentUserId) return;

    // Double check we haven't already started
    if (battleResultsProcessedRef.current) {
      console.log('[GameFlow] Battle already in progress, skipping');
      return;
    }

    console.log('[GameFlow] Starting battle phase');

    // Update match phase (single database call)
    await updateMatchPhase(matchId, 'battle', turnNumber);
    setPhase('battle');

    // Get players - use store if available, otherwise fetch from database
    let playerList = players;

    if (playerList.length === 0) {
      console.log('[GameFlow] Players array empty, fetching from database');
      try {
        const dbPlayers = await getMatchPlayers(matchId);
        playerList = dbPlayers.map((p: Record<string, unknown>) => ({
          id: p.player_id as string,
          matchId: matchId,
          name: p.player_name as string,
          hp: p.hp as number,
          money: p.money as number,
          level: p.level as number,
          isReady: p.is_ready as boolean,
          isAlive: p.is_alive as boolean,
          isBot: p.is_bot as boolean,
          placement: p.placement as number | null,
          winStreak: (p.win_streak as number) || 0,
          loseStreak: (p.lose_streak as number) || 0,
          lastOpponentId: p.last_opponent_id as string | null,
        }));
        console.log('[GameFlow] Fetched players from database:', playerList.length);
      } catch (err) {
        console.error('[GameFlow] Failed to fetch players:', err);
        return;
      }
    }

    // Generate pairings from players who are alive
    // Note: isAlive might be undefined initially, treat as true
    const alivePlayers = playerList.filter(p => p.isAlive !== false);
    console.log(
      '[GameFlow] Alive players:',
      alivePlayers.length,
      alivePlayers.map(p => p.name)
    );

    const pairings = generatePairings(alivePlayers);

    console.log(
      '[GameFlow] Generated pairings:',
      pairings.length,
      pairings.map(p => `${p.player1Id.slice(0, 8)} vs ${p.player2Id.slice(0, 8)}`)
    );

    // Find current player's opponent for display
    const myPairing = pairings.find(
      p => p.player1Id === currentUserId || p.player2Id === currentUserId
    );

    if (myPairing) {
      const opponentId =
        myPairing.player1Id === currentUserId ? myPairing.player2Id : myPairing.player1Id;

      const opponent = playerList.find(p => p.id === opponentId);
      currentOpponentRef.current = opponent || null;

      // Note: Don't set display board here - we'll set it after fetching real opponent pieces
    }

    // Fetch all player boards from database FIRST
    // This is needed to show real opponent pieces
    try {
      const playerBoards = await getPlayerBoards(matchId);
      console.log('[GameFlow] Fetched player boards:', playerBoards.length);

      if (myPairing) {
        const opponentId =
          myPairing.player1Id === currentUserId ? myPairing.player2Id : myPairing.player1Id;

        const myBoard = playerBoards.find(pb => pb.playerId === currentUserId);
        const opponentBoard = playerBoards.find(pb => pb.playerId === opponentId);
        const opponent = currentOpponentRef.current;

        console.log('[GameFlow] Battle boards:', {
          myPieces: Object.keys(myBoard?.boardState?.pieces || {}).length,
          opponentPieces: Object.keys(opponentBoard?.boardState?.pieces || {}).length,
        });

        // Create initial battle board with REAL opponent pieces
        const emptyBoard: BoardState = {
          pieces: {},
          piecePositions: {},
          size: { width: 6, height: 6 },
        };
        const initialBattleBoard = createBattleBoardFromTwo(
          (myBoard?.boardState as unknown as BoardState) || emptyBoard,
          currentUserId,
          (opponentBoard?.boardState as unknown as BoardState) || emptyBoard,
          opponentId
        );

        // Now set display state with real opponent pieces
        if (opponent) {
          setBattleState(initialBattleBoard, opponent);
        }

        // Run battle if host
        const humanPlayers = alivePlayers.filter(p => !p.name.startsWith('Bot ') && !p.isBot);
        const sortedHumans = [...humanPlayers].sort((a, b) => a.id.localeCompare(b.id));
        const isHost = sortedHumans.length === 0 || sortedHumans[0]?.id === currentUserId;

        if (isHost) {
          console.log('[GameFlow] I am the host, running battle simulation');
          await runBattleTurnByTurn(matchId, initialBattleBoard, currentUserId, opponentId);
        } else {
          console.log('[GameFlow] Not the host, waiting for battle results via Realtime');
        }
      }
    } catch (err) {
      console.error('[GameFlow] Failed to fetch player boards or run battle:', err);
      battleStartedRef.current = false;
    }
  }, [matchId, players, turnNumber, currentUserId, setBattleState, setPhase, runBattleTurnByTurn]);

  // Start new preparation phase
  const startPreparationPhase = useCallback(async () => {
    if (!matchId) return;

    // Reset battle flags for next round
    battleStartedRef.current = false;
    battleResultsProcessedRef.current = false;

    const newTurn = turnNumber + 1;
    setTurnNumber(newTurn);
    setPhase('preparation');
    await updateMatchPhase(matchId, 'preparation', newTurn);

    // Reset ready tracker for new round
    readyTrackerRef.current.players.forEach(status => {
      // Keep bots as ready, reset human players
      if (!status.isBot) {
        status.isReady = false;
      }
    });

    // Publish phase change via Realtime
    await realtimeService.publishPhaseChange(matchId, 'preparation', newTurn);
  }, [matchId, turnNumber, setTurnNumber, setPhase]);

  // End battle phase and go to settlement
  const endBattlePhase = useCallback(async () => {
    if (!matchId) return;

    clearBattle();
    setPhase('settlement');
    await updateMatchPhase(matchId, 'settlement', turnNumber);

    // Short settlement phase
    setTimeout(() => {
      startPreparationPhase();
    }, 3000);
  }, [matchId, turnNumber, clearBattle, setPhase, startPreparationPhase]);

  // Track the matchId that we've subscribed to
  const subscribedMatchIdRef = useRef<string | null>(null);

  // Set up Realtime listeners (no polling!) - only once per match
  useEffect(() => {
    if (!matchId || !currentUserId) return;

    // Only setup if matchId changed or not yet setup
    if (subscribedMatchIdRef.current === matchId && listenersSetupRef.current) {
      console.log('[GameFlow] Listeners already setup for this match, skipping');
      return;
    }

    // If we had a different match subscribed, clean it up first
    if (subscribedMatchIdRef.current && subscribedMatchIdRef.current !== matchId) {
      console.log('[GameFlow] Match changed, cleaning up old subscription');
      realtimeService.unsubscribeFromMatch(subscribedMatchIdRef.current);
    }

    listenersSetupRef.current = true;
    subscribedMatchIdRef.current = matchId;

    console.log('[GameFlow] Setting up Realtime listeners for match:', matchId);

    // Listen for player ready events via Realtime
    realtimeService.onPlayerReady(matchId, (playerId, isReady, isBot) => {
      if (!playerId) {
        console.warn('[GameFlow] Received player ready event with no playerId');
        return;
      }

      const tracker = readyTrackerRef.current;
      console.log('[GameFlow] Player ready event:', {
        playerId: playerId.slice(0, 8),
        isReady,
        isBot,
      });

      // Update tracker
      tracker.players.set(playerId, { isReady, isBot });

      // Update store so UI reflects the ready state
      updatePlayerStats(playerId, { isReady });

      // Check if all players are ready (only trigger once)
      if (isReady && !battleStartedRef.current && tracker.totalPlayers > 0) {
        const readyCount = Array.from(tracker.players.values()).filter(p => p.isReady).length;
        const allReady = readyCount === tracker.totalPlayers;

        console.log('[GameFlow] Ready check:', {
          readyCount,
          totalPlayers: tracker.totalPlayers,
          allReady,
        });

        if (allReady) {
          battleStartedRef.current = true;
          console.log('[GameFlow] All players ready! Starting battle phase...');
          startBattlePhase();
        }
      }
    });

    // Listen for phase changes
    realtimeService.onPhaseChange(matchId, (newPhase, newTurn) => {
      console.log('[GameFlow] Phase change:', newPhase, newTurn);
      setPhase(newPhase as GamePhase);
      setTurnNumber(newTurn);
    });

    // Listen for battle results from Edge Function
    realtimeService.onBattleResults(matchId, resultsPayload => {
      if (!currentUserId) return;

      // Prevent processing multiple times
      if (battleResultsProcessedRef.current) {
        console.log('[GameFlow] Battle results already processed, skipping');
        return;
      }
      battleResultsProcessedRef.current = true;

      console.log('[GameFlow] Processing battle results');

      // Find my result
      const myResult = resultsPayload.results.find(
        r => r.player1Id === currentUserId || r.player2Id === currentUserId
      );

      if (myResult) {
        // Update battle board with final state
        const finalBoard = myResult.finalBoard as unknown as BoardState;
        const opponent = currentOpponentRef.current;

        if (opponent) {
          setBattleState(finalBoard, opponent);
        }

        // Set and apply result immediately (skip animation for now)
        const result: BattleResult = myResult.result;
        setBattleResult(result);
        applyBattleResult(result);

        // Transition to settlement after delay
        setTimeout(() => {
          clearBattle();
          setPhase('settlement');

          // Then start new preparation phase
          setTimeout(async () => {
            battleStartedRef.current = false;
            battleResultsProcessedRef.current = false;

            const newTurn = useGameStore.getState().turnNumber + 1;
            setTurnNumber(newTurn);
            setPhase('preparation');

            // Reset ALL players' ready status
            readyTrackerRef.current.players.forEach((status, playerId) => {
              status.isReady = false;
              updatePlayerStats(playerId, { isReady: false });
            });

            // Publish phase change so bots hear about new round
            if (matchId) {
              console.log('[GameFlow] Publishing phase change to preparation, turn:', newTurn);
              await realtimeService.publishPhaseChange(matchId, 'preparation', newTurn);
            }
          }, 2000);
        }, 2000);
      } else {
        console.warn('[GameFlow] No battle result found for current user');
        setTimeout(() => {
          battleStartedRef.current = false;
          battleResultsProcessedRef.current = false;
          setPhase('preparation');
        }, 2000);
      }
    });

    return () => {
      // Only unsubscribe on actual unmount, not on re-renders due to dependency changes
      // The matchId check at the start of the effect handles the case where matchId changes
      // This cleanup only runs on true unmount
      listenersSetupRef.current = false;
      // Don't unsubscribe here - it causes issues when dependencies change but matchId stays the same
      // The subscription is cleaned up when matchId changes (handled above) or when leaving the game
    };
    // Note: We intentionally exclude startBattlePhase from dependencies because it changes frequently
    // when players array updates. The function is called via closure and always uses latest state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, currentUserId]);

  // Cleanup subscription only on unmount
  useEffect(() => {
    return () => {
      if (subscribedMatchIdRef.current) {
        console.log('[GameFlow] Component unmounting, cleaning up subscription');
        realtimeService.unsubscribeFromMatch(subscribedMatchIdRef.current);
        subscribedMatchIdRef.current = null;
      }
    };
  }, []);

  // Update ready tracker when players change
  useEffect(() => {
    if (players.length > 0) {
      const tracker = readyTrackerRef.current;
      // Only initialize if not already done or if player count changed
      if (tracker.totalPlayers !== players.length) {
        tracker.players.clear();
        tracker.totalPlayers = players.length;

        players.forEach(player => {
          const isBot = player.name.startsWith('Bot ') || player.isBot;
          tracker.players.set(player.id, { isReady: isBot, isBot });
        });

        console.log('[GameFlow] Initialized ready tracker:', {
          totalPlayers: tracker.totalPlayers,
          players: Array.from(tracker.players.entries()).map(([id, status]) => ({
            id: id.slice(0, 8),
            ...status,
          })),
        });
      }
    }
  }, [players]);

  return {
    checkAllPlayersReady: checkAllPlayersReadyLocal,
    startBattlePhase,
    endBattlePhase,
    startPreparationPhase,
  };
}

export default useGameFlow;
