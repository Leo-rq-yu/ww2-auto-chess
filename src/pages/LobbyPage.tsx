import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { Button, Card } from '../components/ui';
import { 
  Users, 
  Plus, 
  Play, 
  RefreshCw, 
  Trophy,
  Sword,
  Shield,
  Target,
  Plane
} from 'lucide-react';
import { createMatch, joinMatch, getWaitingMatches, fillWithBots, getMatch } from '../services/matchService';
import { insforge } from '../services';
import botService from '../services/botService';
import useGameStore from '../store/gameStore';
// STARTING_HP, STARTING_MONEY are used in matchService

export function LobbyPage() {
  const navigate = useNavigate();
  const { setUser, setMatch } = useGameStore();
  
  const [playerName, setPlayerName] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load matches on mount
  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const data = await getWaitingMatches();
      setMatches(data || []);
    } catch (err) {
      console.error('Failed to load matches:', err);
    }
  };

  const handleCreateMatch = async () => {
    if (!playerName.trim()) {
      setError('Please enter a player name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Create or get player
      const playerId = uuidv4();
      const uniqueUsername = `${playerName}#${playerId.slice(0, 4)}`;
      
      // Try to create player in database
      await insforge.database
        .from('players')
        .insert({ id: playerId, username: uniqueUsername });

      // Create match
      const match = await createMatch(playerId, playerName);
      
      // Set local state
      setUser(playerId, playerName);
      setMatch({
        matchId: match.match_id,
        status: match.status,
        phase: match.phase || 'preparation',
        turnNumber: match.turn_number || 0,
        maxPlayers: match.max_players,
        winnerId: null,
        createdAt: match.created_at,
        updatedAt: match.updated_at,
      });

      // Navigate to game
      navigate(`/game/${match.match_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinMatch = async (matchId: string) => {
    if (!playerName.trim()) {
      setError('Please enter a player name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const playerId = uuidv4();
      const uniqueUsername = `${playerName}#${playerId.slice(0, 4)}`;
      
      // Create player
      await insforge.database
        .from('players')
        .insert({ id: playerId, username: uniqueUsername });

      // Join match
      const match = await joinMatch(matchId, playerId, playerName);
      
      setUser(playerId, playerName);
      setMatch({
        matchId: match.match_id,
        status: match.status,
        phase: match.phase || 'preparation',
        turnNumber: match.turn_number || 0,
        maxPlayers: match.max_players,
        winnerId: null,
        createdAt: match.created_at,
        updatedAt: match.updated_at,
      });

      navigate(`/game/${matchId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPlay = async () => {
    if (!playerName.trim()) {
      setError('Please enter a player name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const playerId = uuidv4();
      // Generate a unique username by appending a random suffix
      const uniqueUsername = `${playerName}#${playerId.slice(0, 4)}`;
      
      await insforge.database
        .from('players')
        .insert({ id: playerId, username: uniqueUsername });

      // Create match
      const match = await createMatch(playerId, playerName);
      
      // Fill with bots immediately
      await fillWithBots(match.match_id);
      
      // Fetch full match data to get bot players
      const fullMatch = await getMatch(match.match_id);
      
      // Initialize bot states
      const botPlayers = fullMatch.match_players.filter((p: any) => p.is_bot);
      for (const bot of botPlayers) {
        botService.initializeBot(match.match_id, {
          id: bot.player_id,
          matchId: match.match_id,
          name: bot.player_name,
          hp: bot.hp,
          money: bot.money,
          level: bot.level,
          isReady: false,
          isAlive: true,
          isBot: true,
          placement: null,
          winStreak: 0,
          loseStreak: 0,
          lastOpponentId: null,
        });
      }
      
      setUser(playerId, playerName);
      setMatch({
        matchId: match.match_id,
        status: 'starting',
        phase: 'preparation',
        turnNumber: 0,
        maxPlayers: match.max_players,
        winnerId: null,
        createdAt: match.created_at,
        updatedAt: match.updated_at,
      });

      navigate(`/game/${match.match_id}`);
    } catch (err: any) {
      setError(err.message || 'Quick start failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 text-white">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-black mb-2">
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              WW2 Auto-Chess
            </span>
          </h1>
          <p className="text-stone-400 text-lg">
            Strategic Battle Royale
          </p>
          
          {/* Unit Icons */}
          <div className="flex justify-center gap-4 mt-6">
            {[Sword, Shield, Target, Plane].map((Icon, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="w-12 h-12 bg-stone-800 rounded-xl flex items-center justify-center border border-stone-700"
              >
                <Icon className="text-amber-400" size={24} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Player Setup */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card variant="elevated" className="p-6">
              <h2 className="text-xl font-bold text-amber-400 mb-4">Player Setup</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-stone-400 mb-2">Player Name</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name..."
                    className="w-full px-4 py-3 bg-stone-900 border-2 border-stone-700 rounded-lg
                      text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none
                      transition-colors"
                    maxLength={20}
                  />
                </div>

                {error && (
                  <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleQuickPlay}
                  isLoading={isLoading}
                  className="w-full flex items-center justify-center"
                  size="lg"
                >
                  <Play size={20} className="mr-2" />
                  Quick Start (vs AI)
                </Button>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleCreateMatch}
                    isLoading={isCreating}
                    className="flex-1 flex items-center justify-center"
                  >
                    <Plus size={16} className="mr-2" />
                    Create Room
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Room List */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card variant="elevated" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                  <Users size={20} />
                  Available Rooms
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadMatches}
                >
                  <RefreshCw size={14} />
                </Button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {matches.length === 0 ? (
                  <div className="text-center py-8 text-stone-500">
                    <Users size={40} className="mx-auto mb-2 opacity-50" />
                    <p>No rooms available</p>
                    <p className="text-sm mt-1">Create a new room to start!</p>
                  </div>
                ) : (
                  matches.map((match) => (
                    <motion.div
                      key={match.match_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 bg-stone-900/50 rounded-lg
                        hover:bg-stone-800/50 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-stone-200">
                          Room #{match.match_id.slice(0, 8)}
                        </div>
                        <div className="text-sm text-stone-500">
                          {match.match_players?.[0]?.count || 1}/8 Players
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleJoinMatch(match.match_id)}
                      >
                        Join
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Game Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-4xl mx-auto mt-8"
        >
          <Card className="p-6">
            <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
              <Trophy size={20} />
              How to Play
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-stone-400">
              <div>
                <h4 className="font-semibold text-stone-200 mb-2">🎮 Game Rules</h4>
                <p>8 players battle in auto-chess style. Each turn you're matched against an opponent. Last one standing wins!</p>
              </div>
              <div>
                <h4 className="font-semibold text-stone-200 mb-2">⚔️ Unit Types</h4>
                <p>7 unique units: Infantry, Engineer, Armored Car, Tank, Artillery, Anti-Air, and Aircraft.</p>
              </div>
              <div>
                <h4 className="font-semibold text-stone-200 mb-2">⭐ Star Upgrades</h4>
                <p>Combine 3 same-star units to upgrade. Max 3-star with powerful trait bonuses!</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default LobbyPage;
