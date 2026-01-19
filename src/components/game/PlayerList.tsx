import { motion } from 'motion/react';
import { Player } from '../../types';
import { Heart, Trophy, Skull, Crown, Bot, User } from 'lucide-react';

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string;
  onPlayerClick?: (playerId: string) => void;
}

export function PlayerList({ players, currentPlayerId, onPlayerClick }: PlayerListProps) {
  // Sort by HP descending
  const sortedPlayers = [...players].sort((a, b) => b.hp - a.hp);

  return (
    <div className="bg-stone-800/80 rounded-xl p-3 border-2 border-stone-700">
      <h3 className="text-amber-400 font-bold text-sm mb-2 flex items-center gap-2">
        <Trophy size={14} />
        Rankings
      </h3>

      <div className="space-y-1.5">
        {sortedPlayers.map((player, index) => {
          const isCurrentPlayer = player.id === currentPlayerId;
          const isAlive = player.isAlive && player.hp > 0;

          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onPlayerClick?.(player.id)}
              className={`
                flex items-center gap-2 p-2 rounded-lg cursor-pointer
                transition-all duration-200
                ${
                  isCurrentPlayer
                    ? 'bg-amber-500/20 border border-amber-500/50'
                    : 'bg-stone-900/50 hover:bg-stone-700/50 border border-transparent'
                }
                ${!isAlive ? 'opacity-50 grayscale' : ''}
              `}
            >
              {/* Rank */}
              <div
                className={`
                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${
                  index === 0
                    ? 'bg-amber-500 text-stone-900'
                    : index === 1
                      ? 'bg-stone-400 text-stone-900'
                      : index === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-stone-700 text-stone-400'
                }
              `}
              >
                {isAlive ? index + 1 : <Skull size={12} />}
              </div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {player.isBot ? (
                    <Bot size={12} className="text-purple-400" />
                  ) : (
                    <User size={12} className="text-blue-400" />
                  )}
                  <span
                    className={`
                    text-sm font-medium truncate
                    ${isCurrentPlayer ? 'text-amber-400' : 'text-stone-200'}
                  `}
                  >
                    {player.name}
                    {isCurrentPlayer && ' (You)'}
                  </span>
                  {index === 0 && isAlive && <Crown size={12} className="text-amber-400" />}
                </div>

                {/* Streaks */}
                {(player.winStreak > 0 || player.loseStreak > 0) && (
                  <div className="flex gap-1 mt-0.5">
                    {player.winStreak > 0 && (
                      <span className="text-[10px] text-green-400">🔥 {player.winStreak} Win</span>
                    )}
                    {player.loseStreak > 0 && (
                      <span className="text-[10px] text-red-400">💔 {player.loseStreak} Loss</span>
                    )}
                  </div>
                )}
              </div>

              {/* Stats - HP only (money not real-time for other players) */}
              <div className="flex items-center gap-1">
                <Heart
                  size={12}
                  className={player.hp > 25 ? 'text-red-400' : 'text-red-600'}
                  fill={player.hp > 0 ? 'currentColor' : 'none'}
                />
                <span
                  className={`
                  text-xs font-bold
                  ${player.hp > 25 ? 'text-red-400' : 'text-red-600'}
                `}
                >
                  {player.hp}
                </span>
              </div>

              {/* Ready Indicator */}
              {player.isReady && isAlive && (
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default PlayerList;
