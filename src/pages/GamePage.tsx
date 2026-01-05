import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useUser } from '@insforge/react'
import { useGameStore } from '../store/gameStore'
import { getMatch, getPlayers, getBoardState } from '../services/matchService'
import { subscribeToMatch, onMatchUpdate, onPlayerUpdate } from '../services/realtimeService'
import BoardGrid from '../components/game/BoardGrid'
import Bench from '../components/game/Bench'
import Shop from '../components/game/Shop'
import PlayerList from '../components/game/PlayerList'
import SynergyPanel from '../components/game/SynergyPanel'
import PhaseTimer from '../components/game/PhaseTimer'
import { useGameFlow } from '../hooks/useGameFlow'

export default function GamePage() {
  const { matchId } = useParams<{ matchId: string }>()
  const { user } = useUser()
  const {
    match,
    players,
    currentPlayer,
    setMatch,
    setPlayers,
    setCurrentPlayer,
    setBoardState,
    setBenchState,
    setMatchId,
  } = useGameStore()

  useGameFlow(matchId || '')

  useEffect(() => {
    if (!matchId || !user) return

    setMatchId(matchId)
    loadGameData()

    // Subscribe to real-time updates
    subscribeToMatch(matchId)
    onMatchUpdate((updatedMatch) => {
      setMatch(updatedMatch)
    })
    onPlayerUpdate((updatedPlayers) => {
      setPlayers(updatedPlayers)
      const current = updatedPlayers.find(p => p.playerId === user.id)
      if (current) setCurrentPlayer(current)
    })

    return () => {
      // Cleanup subscriptions
    }
  }, [matchId, user])

  const loadGameData = async () => {
    if (!matchId || !user) return

    try {
      const [matchData, playersData, boardData] = await Promise.all([
        getMatch(matchId),
        getPlayers(matchId),
        getBoardState(matchId, user.id),
      ])

      if (matchData) setMatch(matchData)
      if (playersData) {
        setPlayers(playersData)
        const current = playersData.find(p => p.playerId === user.id)
        if (current) setCurrentPlayer(current)
      }
      if (boardData) {
        setBoardState(boardData)
        // Load bench state from database
        // TODO: Load bench_state from boards table
      }
    } catch (error) {
      console.error('Failed to load game data:', error)
    }
  }

  if (!match) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-gray-900 p-4">
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-4">
        {/* Left: Board and Bench */}
        <div className="col-span-8 space-y-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h2 className="text-white text-xl font-semibold mb-4">Battlefield</h2>
            <BoardGrid />
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h2 className="text-white text-xl font-semibold mb-4">Bench</h2>
            <Bench />
          </div>
        </div>

        {/* Right: Shop, Player List, Synergies */}
        <div className="col-span-4 space-y-4">
          <PhaseTimer />

          <Shop />

          <PlayerList />

          <SynergyPanel />
        </div>
      </div>
    </div>
  )
}
