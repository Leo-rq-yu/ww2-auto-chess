import { useGameStore } from '../../store/gameStore'

export default function PlayerList() {
  const { players } = useGameStore()

  const sortedPlayers = [...players].sort((a, b) => b.hp - a.hp)

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
      <h2 className="text-white text-xl font-semibold mb-4">Players</h2>
      <div className="space-y-2">
        {sortedPlayers.map((player, idx) => (
          <div
            key={player.id}
            className={`
              p-3 rounded
              ${player.isBot ? 'bg-gray-700/50' : 'bg-blue-700/50'}
              ${!player.isAlive ? 'opacity-50' : ''}
            `}
          >
            <div className="flex justify-between items-center">
              <div className="text-white">
                <div className="font-semibold">
                  {idx + 1}. {player.playerName}
                  {player.isBot && <span className="text-gray-400 text-xs ml-2">[AI]</span>}
                </div>
                <div className="text-sm text-gray-300">
                  HP: {player.hp} | Gold: {player.money} | Level: {player.level}
                </div>
              </div>
              {player.isReady && (
                <div className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                  Ready
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
