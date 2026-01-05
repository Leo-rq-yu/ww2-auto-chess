import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import {
  getMatch,
  getPlayers,
  getBoardState,
  updateBoardState,
  updatePlayerStats,
} from '../services/matchService'
import { subscribeToMatch, onPhaseChange, onBattleResults } from '../services/realtimeService'
import { calculateSynergies } from '../engine/synergy'
import { calculateIncome } from '../engine/economy'
import { generateShopCards } from '../engine/shop'
import { runBattle } from '../services/battleService'

export function useGameFlow(matchId: string) {
  const {
    match,
    players,
    currentPlayer,
    boardState,
    benchState,
    shopCards,
    setMatch,
    setPlayers,
    setCurrentPlayer,
    setBoardState,
    setShopCards,
    setSynergies,
    setPhase,
    setIsReady,
  } = useGameStore()

  // const battleStateRef = useRef<BattleState | null>(null)

  useEffect(() => {
    if (!matchId) return

    loadGameState()
    subscribeToMatch(matchId)

    const phaseHandler = (phase: string) => {
      setPhase(phase as any)
      handlePhaseChange(phase)
    }

    const battleHandler = (results: any) => {
      handleBattleResults(results)
    }

    onPhaseChange(phaseHandler)
    onBattleResults(battleHandler)

    return () => {
      // Cleanup handled in realtimeService
    }
  }, [matchId])

  const loadGameState = async () => {
    try {
      const [matchData, playersData] = await Promise.all([
        getMatch(matchId),
        getPlayers(matchId),
      ])

      if (matchData) {
        setMatch(matchData)
        setPhase(matchData.phase)
      }

      if (playersData) {
        setPlayers(playersData)
        const current = playersData.find((p) => !p.isBot)
        if (current) {
          setCurrentPlayer(current)
          const board = await getBoardState(matchId, current.playerId)
          if (board) {
            setBoardState(board)
            // TODO: Load bench state
          }
          // Generate shop cards
          if (shopCards.length === 0) {
            const cards = generateShopCards(current.level, 5)
            setShopCards(cards)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load game state:', error)
    }
  }

  const handlePhaseChange = async (phase: string) => {
    if (phase === 'preparation') {
      // Preparation phase: generate new shop, calculate income
      if (currentPlayer) {
        const cards = generateShopCards(currentPlayer.level, 5)
        setShopCards(cards)
        setIsReady(false)

        // Calculate synergies
        const synergies = calculateSynergies(boardState.pieces)
        setSynergies(synergies)

        // Update database
        await updateBoardState(
          matchId,
          currentPlayer.playerId,
          boardState,
          benchState,
          synergies
        )
      }
    } else if (phase === 'battle') {
      // Battle phase: start battle
      await startBattle()
    } else if (phase === 'settlement') {
      // Settlement phase: calculate income
      await handleSettlement()
    }
  }

  const startBattle = async () => {
    if (!match || !currentPlayer) return

    // Get all surviving players' boards
    const alivePlayers = players.filter((p) => p.isAlive && p.hp > 0)
    if (alivePlayers.length < 2) return

    // Random pairing
    const shuffled = [...alivePlayers].sort(() => Math.random() - 0.5)
    const pairs: Array<[typeof players[0], typeof players[0]]> = []

    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        pairs.push([shuffled[i], shuffled[i + 1]])
      }
    }

    // Run battle for each pair
    for (const [player1, player2] of pairs) {
      await runBattleForPair(player1, player2)
    }
  }

  const runBattleForPair = async (
    player1: typeof players[0],
    player2: typeof players[0]
  ) => {
    try {
      // Get both players' board states
      const [board1, board2] = await Promise.all([
        getBoardState(matchId, player1.playerId),
        getBoardState(matchId, player2.playerId),
      ])

      if (!board1 || !board2) {
        console.error('Failed to load board states')
        return
      }

      // Run battle
      const battleResult = await runBattle(
        matchId,
        match?.turnNumber || 1,
        player1.playerId,
        player2.playerId,
        board1,
        board2
      )

      if (!battleResult.winnerId && !battleResult.loserId) {
        // Draw - both take damage
        await updatePlayerStats(matchId, player1.playerId, {
          hp: Math.max(0, player1.hp - battleResult.damage),
          isAlive: player1.hp - battleResult.damage > 0,
          lastOpponentId: player2.playerId,
        })
        await updatePlayerStats(matchId, player2.playerId, {
          hp: Math.max(0, player2.hp - battleResult.damage),
          isAlive: player2.hp - battleResult.damage > 0,
          lastOpponentId: player1.playerId,
        })
      } else if (battleResult.winnerId && battleResult.loserId) {
        // Update loser
        const loser = battleResult.loserId === player1.playerId ? player1 : player2
        const winner = battleResult.winnerId === player1.playerId ? player1 : player2

        await updatePlayerStats(matchId, loser.playerId, {
          hp: Math.max(0, loser.hp - battleResult.damage),
          isAlive: loser.hp - battleResult.damage > 0,
          lastOpponentId: winner.playerId,
          loseStreak: loser.loseStreak + 1,
          winStreak: 0,
        })

        // Update winner
        await updatePlayerStats(matchId, winner.playerId, {
          winStreak: winner.winStreak + 1,
          loseStreak: 0,
        })
      }
    } catch (error) {
      console.error('Failed to run battle:', error)
    }
  }

  const handleBattleResults = (results: any) => {
    // Handle battle results
    console.log('Battle results:', results)
  }

  const handleSettlement = async () => {
    if (!currentPlayer) return

    // Calculate income
    const income = calculateIncome(
      currentPlayer.money,
      currentPlayer.winStreak,
      currentPlayer.loseStreak,
      false // TODO: Determine win from battle results
    )

    // Update player gold
    await updatePlayerStats(matchId, currentPlayer.playerId, {
      money: currentPlayer.money + income.total,
    })

    // Reload player data
    const playersData = await getPlayers(matchId)
    setPlayers(playersData)
    const updated = playersData.find((p) => p.playerId === currentPlayer.playerId)
    if (updated) setCurrentPlayer(updated)
  }
}
