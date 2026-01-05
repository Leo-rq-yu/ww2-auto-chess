import React from 'react'
import { useGameStore } from '../../store/gameStore'
import { setPlayerReady } from '../../services/matchService'

export default function PhaseTimer() {
  const { match, phase, isReady, currentPlayer, setIsReady } = useGameStore()

  const handleReady = async () => {
    if (!match || !currentPlayer) return

    try {
      await setPlayerReady(match.matchId, currentPlayer.playerId, true)
      setIsReady(true)
    } catch (error) {
      console.error('Failed to set ready:', error)
    }
  }

  const phaseNames: Record<string, string> = {
    preparation: 'Preparation Phase',
    battle: 'Battle Phase',
    settlement: 'Settlement Phase',
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
      <div className="text-white text-center mb-4">
        <div className="text-2xl font-bold">{phaseNames[phase] || phase}</div>
        {match && (
          <div className="text-sm text-gray-300 mt-1">
            Turn {match.turnNumber}
          </div>
        )}
      </div>

      {phase === 'preparation' && !isReady && (
        <button
          onClick={handleReady}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Ready
        </button>
      )}

      {isReady && (
        <div className="text-center text-green-400 font-semibold">
          Ready
        </div>
      )}
    </div>
  )
}
