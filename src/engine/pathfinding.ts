import { Graph, astar } from 'javascript-astar';
import { BoardState, Position, Piece } from '../types';
import { positionToKey, isValidPosition, getDistance } from './board';

// =============================================
// A* Pathfinding Implementation
// Based on creature-chess pathfinding module
// =============================================

export interface Path {
  stepCount: number;
  firstStep: Position;
  fullPath: Position[];
}

export class Pathfinder {
  private graph: Graph;
  private size: { width: number; height: number };

  constructor(size: { width: number; height: number }) {
    this.size = size;
    const weights = this.createEmptyWeightGrid();
    this.graph = new Graph(weights);
  }

  private createEmptyWeightGrid(): number[][] {
    const grid: number[][] = [];
    for (let x = 0; x < this.size.width; x++) {
      const column: number[] = [];
      for (let y = 0; y < this.size.height; y++) {
        column.push(1);  // 1 = walkable
      }
      grid.push(column);
    }
    return grid;
  }

  private setWeights(board: BoardState): void {
    for (let x = 0; x < this.size.width; x++) {
      for (let y = 0; y < this.size.height; y++) {
        const key = positionToKey({ x, y });
        // 0 = blocked (occupied), 1 = walkable
        this.graph.grid[x][y].weight = board.piecePositions[key] ? 0 : 1;
      }
    }
  }

  getPath(board: BoardState, start: Position, end: Position): Position[] | null {
    this.setWeights(board);
    
    // Mark start as walkable (we're standing on it)
    this.graph.grid[start.x][start.y].weight = 1;
    
    // Mark end as walkable (we want to reach it)
    if (isValidPosition(end, board)) {
      this.graph.grid[end.x][end.y].weight = 1;
    }

    const startNode = this.graph.grid[start.x][start.y];
    const endNode = this.graph.grid[end.x]?.[end.y];

    if (!startNode || !endNode) {
      return null;
    }

    const path = astar.search(this.graph, startNode, endNode);

    if (path.length === 0) {
      return null;
    }

    return path.map(node => ({ x: node.x, y: node.y }));
  }

  getFirstStep(board: BoardState, start: Position, end: Position): Path | null {
    const path = this.getPath(board, start, end);

    if (!path || path.length === 0) {
      return null;
    }

    return {
      stepCount: path.length,
      firstStep: path[0],
      fullPath: path,
    };
  }
}

// Get all positions within attack range of a target
export function getAttackPositions(
  boardSize: { width: number; height: number },
  targetPos: Position,
  attackRange: number
): Position[] {
  const positions: Position[] = [];
  
  for (let x = 0; x < boardSize.width; x++) {
    for (let y = 0; y < boardSize.height; y++) {
      const pos = { x, y };
      if (getDistance(pos, targetPos) <= attackRange) {
        positions.push(pos);
      }
    }
  }
  
  return positions;
}

// Sort paths by step count and direction priority
export function sortPaths(
  paths: Path[],
  startPos: Position,
  facingUp: boolean
): void {
  const forwardY = facingUp ? -1 : 1;
  const directionPriority = [
    { x: 0, y: forwardY },   // Forward
    { x: forwardY, y: 0 },   // Right (relative to facing)
    { x: 0, y: -forwardY },  // Backward
    { x: -forwardY, y: 0 },  // Left (relative to facing)
  ];

  const getPriority = (step: Position): number => {
    const dx = step.x - startPos.x;
    const dy = step.y - startPos.y;
    return directionPriority.findIndex(dir => dir.x === dx && dir.y === dy);
  };

  paths.sort((a, b) => {
    if (a.stepCount !== b.stepCount) {
      return a.stepCount - b.stepCount;
    }
    return getPriority(a.firstStep) - getPriority(b.firstStep);
  });
}

// Find the best next position to move towards a target
export function getNextPiecePosition(
  pathfinder: Pathfinder,
  attackerPos: Position,
  attackerFacingUp: boolean,
  attackRange: number,
  targetPos: Position,
  board: BoardState
): Position | null {
  // Get all positions from which we can attack the target
  const attackPositions = getAttackPositions(board.size, targetPos, attackRange);
  
  // Find paths to each attack position
  const paths: Path[] = [];
  for (const pos of attackPositions) {
    const path = pathfinder.getFirstStep(board, attackerPos, pos);
    if (path) {
      paths.push(path);
    }
  }

  if (paths.length === 0) {
    return null;
  }

  // Sort paths by shortest and direction priority
  sortPaths(paths, attackerPos, attackerFacingUp);

  // Return the first step of the best path
  const bestPath = paths[0];
  if (bestPath.firstStep.x < 0 || bestPath.firstStep.y < 0) {
    return null;
  }

  return bestPath.firstStep;
}

// Find nearest enemy for targeting
export function findNearestEnemy(
  board: BoardState,
  piece: Piece,
  piecePos: Position
): { piece: Piece; position: Position; distance: number } | null {
  let nearest: { piece: Piece; position: Position; distance: number } | null = null;

  for (const [key, otherId] of Object.entries(board.piecePositions)) {
    const other = board.pieces[otherId];
    if (!other || other.ownerId === piece.ownerId || other.currentHp <= 0) {
      continue;
    }

    const otherPos = { x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) };
    const distance = getDistance(piecePos, otherPos);

    if (!nearest || distance < nearest.distance) {
      nearest = { piece: other, position: otherPos, distance };
    }
  }

  return nearest;
}

// Find enemy within attack range
export function findEnemyInRange(
  board: BoardState,
  piece: Piece,
  piecePos: Position,
  attackRange: number
): { piece: Piece; position: Position } | null {
  for (const [key, otherId] of Object.entries(board.piecePositions)) {
    const other = board.pieces[otherId];
    if (!other || other.ownerId === piece.ownerId || other.currentHp <= 0) {
      continue;
    }

    const otherPos = { x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) };
    const distance = getDistance(piecePos, otherPos);

    if (distance <= attackRange) {
      return { piece: other, position: otherPos };
    }
  }

  return null;
}

