import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import useGameStore from "../store/gameStore";
import { useGameFlow } from "../hooks/useGameFlow";
import {
  BoardGrid,
  Bench,
  Shop,
  PlayerList,
  SynergyPanel,
  PhaseTimer,
  UnitDetailCard,
} from "../components/game";
import { Button, Modal } from "../components/ui";
import {
  getMatch,
  setPlayerReady,
  updateBoardState,
} from "../services/matchService";
import { realtimeService } from "../services/realtimeService";
import botService from "../services/botService";
import { createShopState } from "../engine/shop";
import { Position, Player, Piece } from "../types";
import {
  Home,
  Settings,
  HelpCircle,
  Volume2,
  VolumeX,
  Coins,
  Heart,
} from "lucide-react";

interface MatchPlayer {
  player_id: string;
  player_name: string;
  hp: number;
  money: number;
  level: number;
  is_ready: boolean;
  is_alive: boolean;
  is_bot: boolean;
  placement: number;
  win_streak?: number;
  lose_streak?: number;
  last_opponent_id?: string;
}

export function GamePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const {
    currentUserId,
    currentUserName,
    currentPlayer,
    players,
    board,
    battleBoard,
    bench,
    shop,
    cardPool,
    synergies,
    selectedPieceId,
    phase,
    turnNumber,
    isReady,
    setMatch,
    setPlayers,
    setPhase,
    setTurnNumber,
    selectPiece,
    placePiece,
    deployFromBench,
    returnToBench,
    sellPiece,
    buyCard,
    refreshShop,
    toggleReady,
    checkAndMerge,
    updatePlayerStats,
    syncFromServer,
  } = useGameStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isShopLocked, setIsShopLocked] = useState(false);
  const [hoveredPiece, setHoveredPiece] = useState<Piece | null>(null);

  // Use game flow hook for battle phase management
  useGameFlow(matchId || null, currentUserId);

  // Load game data
  useEffect(() => {
    if (!matchId || !currentUserId) {
      navigate("/");
      return;
    }

    loadGameData();
    setupRealtime();

    return () => {
      realtimeService.unsubscribeFromMatch(matchId);
    };
  }, [matchId, currentUserId]);

  const loadGameData = async () => {
    if (!matchId || !currentUserId) return;

    try {
      setIsLoading(true);

      // Load match data
      const match = await getMatch(matchId);

      setMatch({
        matchId: match.match_id,
        status: match.status,
        phase: match.phase || "preparation",
        turnNumber: match.turn_number || 0,
        maxPlayers: match.max_players,
        winnerId: match.winner_id,
        createdAt: match.created_at,
        updatedAt: match.updated_at,
      });

      // Set players
      const playersList = match.match_players.map((p: MatchPlayer) => ({
        id: p.player_id,
        matchId: match.match_id,
        name: p.player_name,
        hp: p.hp,
        money: p.money,
        level: p.level,
        isReady: p.is_ready,
        isAlive: p.is_alive,
        isBot: p.is_bot,
        placement: p.placement,
        winStreak: p.win_streak || 0,
        loseStreak: p.lose_streak || 0,
        lastOpponentId: p.last_opponent_id,
      }));

      setPlayers(playersList);

      // Initialize shop if needed
      if (shop.cards.length === 0) {
        const newShop = createShopState(currentPlayer?.level || 1, cardPool);
        syncFromServer({ shop: newShop });
      }

      // Initialize bots with AI and Realtime subscriptions
      const botPlayers = playersList.filter((p: Player) => p.isBot);
      if (botPlayers.length > 0) {
        console.log("[GamePage] Initializing", botPlayers.length, "AI bots");
        await botService.initializeAndSubscribeBots(match.match_id, botPlayers);

        // Trigger bot AI decisions after a delay (they will use InsForge AI Gateway)
        setTimeout(async () => {
          for (const bot of botPlayers) {
            await botService.runBotAIDecision(match.match_id, bot.id);
          }
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to load game:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtime = async () => {
    if (!matchId) return;

    await realtimeService.subscribeToMatch(matchId, (payload) => {
      setPhase(payload.phase as any);
      setTurnNumber(payload.turn_number);
    });

    await realtimeService.subscribeToPlayers(matchId, (payload) => {
      // For current player: DON'T update money/hp from database as local state is authoritative
      // Only update isReady and isAlive from realtime
      if (payload.player_id === currentUserId) {
        updatePlayerStats(payload.player_id, {
          isReady: payload.is_ready,
          isAlive: payload.is_alive,
        });
      } else {
        // For other players: update all stats from database
        updatePlayerStats(payload.player_id, {
          hp: payload.hp,
          money: payload.money,
          isReady: payload.is_ready,
          isAlive: payload.is_alive,
        });
      }
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D") {
        if (selectedPieceId) {
          sellPiece(selectedPieceId);
        }
      }
      if (e.key === "e" || e.key === "E") {
        if (!isShopLocked) {
          refreshShop();
        }
      }
      if (e.key === "f" || e.key === "F") {
        setIsShopLocked(!isShopLocked);
      }
      if (e.key === " ") {
        e.preventDefault();
        handleToggleReady();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPieceId, isShopLocked]);

  // Auto-merge check
  useEffect(() => {
    checkAndMerge();
  }, [bench]);

  const handleTileClick = (position: Position) => {
    if (selectedPieceId) {
      // Check if selected piece is on bench
      const benchPiece = bench.find((p) => p.id === selectedPieceId);
      if (benchPiece) {
        deployFromBench(selectedPieceId, position);
      } else {
        placePiece(selectedPieceId, position);
      }
    }
  };

  const handlePieceClick = (pieceId: string) => {
    if (selectedPieceId === pieceId) {
      selectPiece(null);
    } else {
      selectPiece(pieceId);
    }
  };

  const handlePieceRightClick = (pieceId: string) => {
    // Return to bench
    const piece = board.pieces[pieceId];
    if (piece && piece.isOnBoard) {
      returnToBench(pieceId);
    }
  };

  const handlePieceHover = (piece: Piece | null) => {
    setHoveredPiece(piece);
  };

  const handleToggleReady = async () => {
    const newReadyState = !isReady;
    toggleReady();

    if (matchId && currentUserId) {
      console.log("[GamePage] Player ready state changed to:", newReadyState);

      // Save board state to database when ready (needed for Edge Function)
      if (newReadyState) {
        try {
          await updateBoardState(
            matchId,
            currentUserId,
            board as any,
            bench as any
          );
          console.log("[GamePage] Board state saved to database");
        } catch (err) {
          console.error("[GamePage] Failed to save board state:", err);
        }
      }

      // Publish ready state via Realtime - this triggers the game flow!
      await realtimeService.publishPlayerReady(
        matchId,
        currentUserId,
        newReadyState
      );

      // Also update database for persistence (non-blocking)
      setPlayerReady(matchId, currentUserId, newReadyState).catch((err) => {
        console.warn(
          "[GamePage] Failed to persist ready state to database:",
          err
        );
      });
    }
  };

  const handleBuyCard = (index: number) => {
    console.log("[GamePage] handleBuyCard called with index:", index);
    buyCard(index);
  };

  const handleRefreshShop = () => {
    if (!isShopLocked) {
      refreshShop();
    }
  };

  const handleToggleShopLock = () => {
    setIsShopLocked(!isShopLocked);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-stone-400">Loading game...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 text-white overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 bg-stone-900/80 border-b border-stone-700 backdrop-blur-sm px-4 flex items-center justify-between">
        {/* Left - Player Info */}
        <div className="flex items-center gap-4 w-[260px]">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <Home size={18} />
          </Button>

          <div className="flex items-center gap-4 px-4 py-1 bg-stone-800/50 rounded-lg">
            <span className="text-amber-400 font-bold">{currentUserName}</span>
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-red-400 fill-current" />
              <span className="font-bold">{currentPlayer?.hp ?? "--"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-amber-400" />
              <span className="font-bold">{currentPlayer?.money ?? "--"}</span>
            </div>
          </div>
        </div>

        {/* Center - Phase Timer */}
        <PhaseTimer
          phase={phase}
          turnNumber={turnNumber}
          isReady={isReady}
          onReady={handleToggleReady}
        />

        {/* Right - Controls */}
        <div className="flex items-center justify-end gap-2 w-[260px]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)}>
            <HelpCircle size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={18} />
          </Button>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Player List & Synergies */}
        <div className="w-[356px] flex-shrink-0 p-3 space-y-3 overflow-y-auto">
          <PlayerList players={players} currentPlayerId={currentUserId || ""} />
          <SynergyPanel synergies={synergies} />
        </div>

        {/* Center - Board */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl"
          >
            <BoardGrid
              board={phase === "battle" && battleBoard ? battleBoard : board}
              playerId={currentUserId || ""}
              selectedPieceId={selectedPieceId}
              onTileClick={handleTileClick}
              onPieceClick={handlePieceClick}
              onPieceRightClick={handlePieceRightClick}
              onPieceHover={handlePieceHover}
              isPreparation={phase === "preparation"}
            />
          </motion.div>

          {/* Bench */}
          <div className="mt-4 w-full max-w-2xl">
            <Bench
              pieces={bench}
              selectedPieceId={selectedPieceId}
              onPieceClick={handlePieceClick}
              onPieceRightClick={(id) => sellPiece(id)}
              onPieceHover={handlePieceHover}
            />
          </div>
        </div>

        {/* Right Sidebar - Shop */}
        <div className="flex-shrink-0 p-3 overflow-y-auto">
          <Shop
            shop={shop}
            playerMoney={currentPlayer?.money || 0}
            onBuyCard={handleBuyCard}
            onRefresh={handleRefreshShop}
            isLocked={isShopLocked}
            onToggleLock={handleToggleShopLock}
          />
        </div>
      </div>

      {/* Unit Detail Card - Shows on hover from board/bench */}
      <UnitDetailCard piece={hoveredPiece} visible={!!hoveredPiece} />

      {/* Help Modal */}
      <Modal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Game Help"
      >
        <div className="space-y-4 text-stone-300">
          <div>
            <h4 className="font-bold text-amber-400 mb-2">Hotkeys</h4>
            <ul className="text-sm space-y-1">
              <li>
                <kbd className="bg-stone-700 px-2 py-0.5 rounded">D</kbd> - Sell
                selected unit
              </li>
              <li>
                <kbd className="bg-stone-700 px-2 py-0.5 rounded">E</kbd> -
                Refresh shop
              </li>
              <li>
                <kbd className="bg-stone-700 px-2 py-0.5 rounded">F</kbd> -
                Lock/Unlock shop
              </li>
              <li>
                <kbd className="bg-stone-700 px-2 py-0.5 rounded">Space</kbd> -
                Ready/Cancel
              </li>
              <li>
                <kbd className="bg-stone-700 px-2 py-0.5 rounded">
                  Right Click
                </kbd>{" "}
                - Return to bench / Sell
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-amber-400 mb-2">Game Rules</h4>
            <ul className="text-sm space-y-1">
              <li>• Buy units from shop and place on board</li>
              <li>• 3 identical units merge into higher star</li>
              <li>• Collect same type units to activate synergy</li>
              <li>• Battle starts when all players ready</li>
              <li>• Losers take damage, eliminated at 0 HP</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Settings"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Sound</span>
            <Button
              variant={isMuted ? "secondary" : "primary"}
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? "Off" : "On"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default GamePage;
