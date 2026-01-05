import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@insforge/react'
import { createMatch } from '../services/matchService'
import { useGameStore } from '../store/gameStore'

export default function LobbyPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  const { setUserId, setMatchId: setStoreMatchId } = useGameStore()

  useEffect(() => {
    if (user) {
      setUserId(user.id)
    }
  }, [user, setUserId])

  const handleCreateMatch = async () => {
    if (!user) return

    setIsCreating(true)
    try {
      const newMatchId = await createMatch(
        user.id,
        user.email || user.id
      )
      setStoreMatchId(newMatchId)
      navigate(`/game/${newMatchId}`)
    } catch (error) {
      console.error('Failed to create match:', error)
      alert('Failed to create match')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinMatch = () => {
    const input = prompt('Enter match ID:')
    if (input) {
      setStoreMatchId(input)
      navigate(`/game/${input}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-8 text-center">
          WWII Auto Chess
        </h1>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-white mb-6">Game Lobby</h2>

          <div className="space-y-4">
            <button
              onClick={handleCreateMatch}
              disabled={isCreating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg"
            >
              {isCreating ? 'Creating...' : 'Create New Match'}
            </button>

            <button
              onClick={handleJoinMatch}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg"
            >
              Join Match
            </button>
          </div>

          <div className="mt-8 p-4 bg-blue-900/50 rounded-lg">
            <h3 className="text-white font-semibold mb-2">Game Rules</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• 8-player auto-battler game</li>
              <li>• Purchase and deploy military units</li>
              <li>• Automated combat system</li>
              <li>• Last player standing wins</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
