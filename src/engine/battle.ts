import { Unit, Fortification, UnitType } from '../types/units'
import { Board, BOARD_WIDTH, BOARD_HEIGHT } from './board'
import { BattleEvent } from '../types/game'
import { applySynergyEffects, ActiveSynergy } from './synergy'

// Simplified A* pathfinding (using simple BFS)
function findPath(
  board: Board,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  maxSteps: number
): { x: number; y: number }[] | null {
  const visited = new Set<string>()
  const queue: Array<{ x: number; y: number; path: Array<{ x: number; y: number }> }> = [
    { x: fromX, y: fromY, path: [{ x: fromX, y: fromY }] }
  ]

  const directions = [
    { dx: 0, dy: -1 }, // Up
    { dx: 1, dy: 0 },  // Right
    { dx: 0, dy: 1 },  // Down
    { dx: -1, dy: 0 }, // Left
  ]

  while (queue.length > 0 && queue[0].path.length <= maxSteps + 1) {
    const current = queue.shift()!
    const key = `${current.x},${current.y}`

    if (visited.has(key)) continue
    visited.add(key)

    if (current.x === toX && current.y === toY) {
      return current.path
    }

    for (const dir of directions) {
      const nx = current.x + dir.dx
      const ny = current.y + dir.dy

      if (!board.isValidPosition(nx, ny)) continue
      if (board.isOccupied(nx, ny)) continue
      if (visited.has(`${nx},${ny}`)) continue

      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: nx, y: ny }],
      })
    }
  }

  return null
}

function findNearestEnemy(
  board: Board,
  unit: Unit,
  enemyPieces: Unit[]
): Unit | null {
  let nearest: Unit | null = null
  let minDist = Infinity

  enemyPieces.forEach(enemy => {
    if (enemy.x === undefined || enemy.y === undefined) return
    if (unit.x === undefined || unit.y === undefined) return

    const dist = Math.abs(unit.x - enemy.x) + Math.abs(unit.y - enemy.y)
    if (dist < minDist && dist <= unit.range + unit.speed) {
      minDist = dist
      nearest = enemy
    }
  })

  return nearest
}

function calculateDamage(
  attacker: Unit,
  defender: Unit,
  isAirUnit: boolean
): number {
  let damage = Math.floor(
    Math.random() * (attacker.attack[1] - attacker.attack[0] + 1) + attacker.attack[0]
  )

  // Type advantages
  if (attacker.type === 'armored_car' && defender.type === 'infantry') {
    damage += 1
  }
  if (attacker.type === 'tank' && defender.type === 'armored_car') {
    damage += 1
  }
  if (attacker.type === 'anti_air' && isAirUnit) {
    damage = Math.floor(damage * 1.5) // 4-5 vs air
  }
  if (attacker.type === 'anti_air' && (defender.type === 'tank' || defender.type === 'armored_car')) {
    damage = Math.floor(damage * 0.5) // Half damage to heavy armor
  }

  // Trait effects
  if (attacker.traits.includes('armor_piercing')) {
    if (defender.type === 'tank' || defender.type === 'armored_car') {
      damage += 1
    }
  }

  // Armor reduction
  damage = Math.max(1, damage - defender.armor)

  return damage
}

function canAttack(attacker: Unit, defender: Unit): boolean {
  if (attacker.x === undefined || attacker.y === undefined) return false
  if (defender.x === undefined || defender.y === undefined) return false

  const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y)
  
  // Artillery and anti-air cannot attack aircraft
  if ((attacker.type === 'artillery' || attacker.type === 'anti_air') && defender.type === 'aircraft') {
    return false
  }

  return dist <= attacker.range
}

export interface BattleState {
  player1Pieces: Unit[]
  player2Pieces: Unit[]
  player1Fortifications: Fortification[]
  player2Fortifications: Fortification[]
  player1Synergies: ActiveSynergy[]
  player2Synergies: ActiveSynergy[]
  events: BattleEvent[]
  turn: number
  isFinished: boolean
  winner?: 'player1' | 'player2'
}

export function runBattleTurn(state: BattleState): BattleState {
  const newState = { ...state, turn: state.turn + 1 }
  const events: BattleEvent[] = []

  // Create temporary board
  const board = new Board(
    [...state.player1Pieces, ...state.player2Pieces],
    [...state.player1Fortifications, ...state.player2Fortifications]
  )

  // Sort all units by speed
  const allUnits = [...state.player1Pieces, ...state.player2Pieces]
    .filter(u => u.hp > 0 && u.x !== undefined && u.y !== undefined)
    .sort((a, b) => b.speed - a.speed)

  // Process each unit's turn
  for (const unit of allUnits) {
    if (unit.hp <= 0) continue

    const isPlayer1 = state.player1Pieces.includes(unit)
    const enemyPieces = isPlayer1 ? state.player2Pieces : state.player1Pieces
    const enemyForts = isPlayer1 ? state.player2Fortifications : state.player1Fortifications

    // Apply synergy effects
    const synergies = isPlayer1 ? state.player1Synergies : state.player2Synergies
    const enhancedUnit = applySynergyEffects(unit, synergies)

    // Find nearest enemy
    const nearestEnemy = findNearestEnemy(board, enhancedUnit, enemyPieces.filter(e => e.hp > 0))

    if (nearestEnemy && nearestEnemy.x !== undefined && nearestEnemy.y !== undefined) {
      // Try to attack
      if (canAttack(enhancedUnit, nearestEnemy)) {
        const isAirUnit = nearestEnemy.type === 'aircraft'
        const damage = calculateDamage(enhancedUnit, nearestEnemy, isAirUnit)
        nearestEnemy.hp = Math.max(0, nearestEnemy.hp - damage)

        events.push({
          type: 'attack',
          unitId: unit.id,
          targetId: nearestEnemy.id,
          damage,
          message: `${enhancedUnit.type} deals ${damage} damage to ${nearestEnemy.type}`,
        })

        if (nearestEnemy.hp <= 0) {
          events.push({
            type: 'death',
            unitId: nearestEnemy.id,
            message: `${nearestEnemy.type} defeated`,
          })
          board.removePiece(nearestEnemy.x, nearestEnemy.y)
        }
      } else if (enhancedUnit.speed > 0 && unit.x !== undefined && unit.y !== undefined) {
        // Try to move
        const path = findPath(
          board,
          unit.x,
          unit.y,
          nearestEnemy.x,
          nearestEnemy.y,
          enhancedUnit.speed
        )

        if (path && path.length > 1) {
          const nextStep = path[1]
          if (board.movePiece(unit.x, unit.y, nextStep.x, nextStep.y)) {
            events.push({
              type: 'move',
              unitId: unit.id,
              from: { x: unit.x, y: unit.y },
              to: { x: nextStep.x, y: nextStep.y },
              message: `${enhancedUnit.type} moves to (${nextStep.x}, ${nextStep.y})`,
            })
          }
        }
      }
    }
  }

  // Check win/loss
  const player1Alive = state.player1Pieces.filter(u => u.hp > 0).length
  const player2Alive = state.player2Pieces.filter(u => u.hp > 0).length

  if (player1Alive === 0 || player2Alive === 0 || newState.turn > 50) {
    newState.isFinished = true
    if (player1Alive > 0) {
      newState.winner = 'player1'
    } else if (player2Alive > 0) {
      newState.winner = 'player2'
    }
  }

  newState.events = [...state.events, ...events]
  newState.player1Pieces = state.player1Pieces.map(u => ({ ...u }))
  newState.player2Pieces = state.player2Pieces.map(u => ({ ...u }))

  return newState
}

export function calculateBattleDamage(survivingPieces: Unit[]): number {
  return survivingPieces
    .filter(u => u.hp > 0)
    .reduce((sum, u) => sum + (u.attack[0] + u.attack[1]) / 2, 0)
}
