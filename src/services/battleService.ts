import { insforge } from './insforge'
import { Unit } from '../types/units'
import { BoardState } from '../types/game'

// Convert our board state format to edge function format
export function convertToBattleBoard(
  player1Pieces: Unit[],
  player2Pieces: Unit[],
  player1Id: string,
  player2Id: string
): {
  pieces: Record<string, any>
  piecePositions: Record<string, string>
  size: { width: number; height: number }
} {
  const pieces: Record<string, any> = {}
  const piecePositions: Record<string, string> = {}

  // Add player 1 pieces
  player1Pieces.forEach((unit) => {
    if (unit.x !== undefined && unit.y !== undefined && unit.hp > 0) {
      const key = `${unit.x},${unit.y}`
      pieces[unit.id] = {
        id: unit.id,
        ownerId: player1Id,
        typeId: unit.type,
        currentHp: unit.hp,
        maxHp: unit.maxHp,
        attackMin: unit.attack[0],
        attackMax: unit.attack[1],
        defense: unit.armor,
        speed: unit.speed,
        range: unit.range,
        starLevel: unit.starLevel,
        traits: unit.traits,
      }
      piecePositions[key] = unit.id
    }
  })

  // Add player 2 pieces
  player2Pieces.forEach((unit) => {
    if (unit.x !== undefined && unit.y !== undefined && unit.hp > 0) {
      const key = `${unit.x},${unit.y}`
      pieces[unit.id] = {
        id: unit.id,
        ownerId: player2Id,
        typeId: unit.type,
        currentHp: unit.hp,
        maxHp: unit.maxHp,
        attackMin: unit.attack[0],
        attackMax: unit.attack[1],
        defense: unit.armor,
        speed: unit.speed,
        range: unit.range,
        starLevel: unit.starLevel,
        traits: unit.traits,
      }
      piecePositions[key] = unit.id
    }
  })

  return {
    pieces,
    piecePositions,
    size: { width: 6, height: 6 },
  }
}

// Run a complete battle between two players
export async function runBattle(
  matchId: string,
  _turn: number,
  player1Id: string,
  player2Id: string,
  player1Board: BoardState,
  player2Board: BoardState
): Promise<{
  winnerId: string | null
  loserId: string | null
  damage: number
  events: any[]
}> {
  // Convert board states to battle format
  const battleBoard = convertToBattleBoard(
    player1Board.pieces,
    player2Board.pieces,
    player1Id,
    player2Id
  )

  let currentBoard = battleBoard
  let allEvents: any[] = []
  let turnNumber = 1
  const maxTurns = 50 // Prevent infinite loops

  // Loop through turns until battle is finished
  while (turnNumber <= maxTurns) {
    const { data, error } = await insforge.functions.invoke('run-battle', {
      body: {
        matchId,
        turn: turnNumber,
        battleBoard: currentBoard,
        player1Id,
        player2Id,
      },
    })

    if (error || !data || !data.success) {
      console.error('Battle error:', error || data)
      // Fallback: calculate simple result
      const player1Alive = player1Board.pieces.filter((p) => p.hp > 0).length
      const player2Alive = player2Board.pieces.filter((p) => p.hp > 0).length
      const damage = Math.max(1, Math.max(player1Alive, player2Alive))

      if (player1Alive > player2Alive) {
        return {
          winnerId: player1Id,
          loserId: player2Id,
          damage,
          events: [],
        }
      } else if (player2Alive > player1Alive) {
        return {
          winnerId: player2Id,
          loserId: player1Id,
          damage,
          events: [],
        }
      } else {
        return {
          winnerId: null,
          loserId: null,
          damage: 2,
          events: [],
        }
      }
    }

    // Accumulate events
    if (data.events) {
      allEvents.push(...data.events)
    }

    // Update current board for next turn
    currentBoard = data.updatedBoard

    // Check if battle is finished
    if (data.isFinished && data.result) {
      const result = data.result
      return {
        winnerId: result.winnerId || null,
        loserId: result.loserId || null,
        damage: result.damageDealt || 0,
        events: allEvents,
      }
    }

    turnNumber++
  }

  // Battle timed out - determine winner by survivors
  const player1Survivors = Object.values(currentBoard.pieces).filter(
    (p: any) => p.ownerId === player1Id && p.currentHp > 0
  ).length
  const player2Survivors = Object.values(currentBoard.pieces).filter(
    (p: any) => p.ownerId === player2Id && p.currentHp > 0
  ).length

  const damage = Math.max(1, Math.max(player1Survivors, player2Survivors))

  if (player1Survivors > player2Survivors) {
    return {
      winnerId: player1Id,
      loserId: player2Id,
      damage,
      events: allEvents,
    }
  } else if (player2Survivors > player1Survivors) {
    return {
      winnerId: player2Id,
      loserId: player1Id,
      damage,
      events: allEvents,
    }
  } else {
    return {
      winnerId: null,
      loserId: null,
      damage: 2,
      events: allEvents,
    }
  }
}
