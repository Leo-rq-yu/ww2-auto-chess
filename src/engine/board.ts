import { BoardState, Piece, Position, BOARD_WIDTH, BOARD_HEIGHT } from '../types';

// =============================================
// Board Management
// =============================================

export function createEmptyBoard(): BoardState {
  return {
    pieces: {},
    piecePositions: {},
    size: { width: BOARD_WIDTH, height: BOARD_HEIGHT },
  };
}

export function positionToKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

export function keyToPosition(key: string): Position {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

export function isValidPosition(pos: Position, board: BoardState): boolean {
  return pos.x >= 0 && pos.x < board.size.width && pos.y >= 0 && pos.y < board.size.height;
}

export function isPositionOccupied(pos: Position, board: BoardState): boolean {
  return positionToKey(pos) in board.piecePositions;
}

export function getPieceAtPosition(pos: Position, board: BoardState): Piece | null {
  const pieceId = board.piecePositions[positionToKey(pos)];
  return pieceId ? board.pieces[pieceId] : null;
}

export function getPiecePosition(pieceId: string, board: BoardState): Position | null {
  for (const [key, id] of Object.entries(board.piecePositions)) {
    if (id === pieceId) {
      return keyToPosition(key);
    }
  }
  return null;
}

export function addPieceToBoard(board: BoardState, piece: Piece, pos: Position): BoardState {
  if (!isValidPosition(pos, board) || isPositionOccupied(pos, board)) {
    return board;
  }

  const key = positionToKey(pos);
  return {
    ...board,
    pieces: {
      ...board.pieces,
      [piece.id]: { ...piece, position: pos, isOnBoard: true, benchSlot: null },
    },
    piecePositions: {
      ...board.piecePositions,
      [key]: piece.id,
    },
  };
}

export function removePieceFromBoard(board: BoardState, pieceId: string): BoardState {
  const pos = getPiecePosition(pieceId, board);
  if (!pos) return board;

  const key = positionToKey(pos);
  const newPieces = { ...board.pieces };
  const newPositions = { ...board.piecePositions };
  
  delete newPieces[pieceId];
  delete newPositions[key];

  return {
    ...board,
    pieces: newPieces,
    piecePositions: newPositions,
  };
}

export function movePiece(board: BoardState, pieceId: string, newPos: Position): BoardState {
  const oldPos = getPiecePosition(pieceId, board);
  if (!oldPos || !isValidPosition(newPos, board)) return board;

  // If target is occupied, cannot move
  if (isPositionOccupied(newPos, board)) return board;

  const oldKey = positionToKey(oldPos);
  const newKey = positionToKey(newPos);

  const newPositions = { ...board.piecePositions };
  delete newPositions[oldKey];
  newPositions[newKey] = pieceId;

  return {
    ...board,
    pieces: {
      ...board.pieces,
      [pieceId]: { ...board.pieces[pieceId], position: newPos },
    },
    piecePositions: newPositions,
  };
}

export function swapPieces(board: BoardState, pieceId1: string, pieceId2: string): BoardState {
  const pos1 = getPiecePosition(pieceId1, board);
  const pos2 = getPiecePosition(pieceId2, board);
  
  if (!pos1 || !pos2) return board;

  const key1 = positionToKey(pos1);
  const key2 = positionToKey(pos2);

  return {
    ...board,
    pieces: {
      ...board.pieces,
      [pieceId1]: { ...board.pieces[pieceId1], position: pos2 },
      [pieceId2]: { ...board.pieces[pieceId2], position: pos1 },
    },
    piecePositions: {
      ...board.piecePositions,
      [key1]: pieceId2,
      [key2]: pieceId1,
    },
  };
}

export function getAllPieces(board: BoardState): Piece[] {
  return Object.values(board.pieces);
}

// Deep clone a board state
export function cloneBoard(board: BoardState): BoardState {
  return {
    pieces: Object.fromEntries(
      Object.entries(board.pieces).map(([id, piece]) => [
        id,
        { ...piece, traits: [...piece.traits] }
      ])
    ),
    piecePositions: { ...board.piecePositions },
    size: { ...board.size },
  };
}

export function getPiecesByOwner(board: BoardState, ownerId: string): Piece[] {
  return Object.values(board.pieces).filter(p => p.ownerId === ownerId);
}

export function getEnemyPieces(board: BoardState, ownerId: string): Piece[] {
  return Object.values(board.pieces).filter(p => p.ownerId !== ownerId);
}

export function getAlivePieces(board: BoardState): Piece[] {
  return Object.values(board.pieces).filter(p => p.currentHp > 0);
}

export function getAlivePiecesByOwner(board: BoardState, ownerId: string): Piece[] {
  return Object.values(board.pieces).filter(p => p.ownerId === ownerId && p.currentHp > 0);
}

// Get all empty positions on the board
export function getEmptyPositions(board: BoardState): Position[] {
  const positions: Position[] = [];
  
  for (let x = 0; x < board.size.width; x++) {
    for (let y = 0; y < board.size.height; y++) {
      const pos = { x, y };
      if (!isPositionOccupied(pos, board)) {
        positions.push(pos);
      }
    }
  }
  
  return positions;
}

// Get Manhattan distance between two positions
export function getDistance(pos1: Position, pos2: Position): number {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

// Check if target is within attack range
export function isInAttackRange(attackerPos: Position, targetPos: Position, range: number): boolean {
  return getDistance(attackerPos, targetPos) <= range;
}

// Get all positions within a certain range (for AOE)
export function getPositionsInRange(center: Position, range: number, board: BoardState): Position[] {
  const positions: Position[] = [];
  
  for (let x = center.x - range; x <= center.x + range; x++) {
    for (let y = center.y - range; y <= center.y + range; y++) {
      const pos = { x, y };
      if (isValidPosition(pos, board) && getDistance(center, pos) <= range) {
        positions.push(pos);
      }
    }
  }
  
  return positions;
}

// Get adjacent positions (for melee range)
export function getAdjacentPositions(pos: Position, board: BoardState): Position[] {
  const directions = [
    { x: 0, y: -1 },  // up
    { x: 1, y: 0 },   // right
    { x: 0, y: 1 },   // down
    { x: -1, y: 0 },  // left
  ];

  return directions
    .map(d => ({ x: pos.x + d.x, y: pos.y + d.y }))
    .filter(p => isValidPosition(p, board));
}

// Get radius AOE positions (for artillery) - target + adjacent 4 positions
export function getRadiusAoePositions(center: Position, board: BoardState): Position[] {
  const positions = [center];
  const adjacent = getAdjacentPositions(center, board);
  return [...positions, ...adjacent];
}

// Get line sweep positions (for aircraft)
export function getLineSweepPositions(
  attackerPos: Position,
  direction: 'horizontal' | 'vertical',
  length: number,
  board: BoardState
): Position[] {
  const positions: Position[] = [];
  
  if (direction === 'horizontal') {
    for (let x = attackerPos.x - length; x <= attackerPos.x + length; x++) {
      const pos = { x, y: attackerPos.y };
      if (isValidPosition(pos, board) && x !== attackerPos.x) {
        positions.push(pos);
      }
    }
  } else {
    for (let y = attackerPos.y - length; y <= attackerPos.y + length; y++) {
      const pos = { x: attackerPos.x, y };
      if (isValidPosition(pos, board) && y !== attackerPos.y) {
        positions.push(pos);
      }
    }
  }
  
  return positions;
}

// Create battle board by combining two players' boards
export function createBattleBoard(
  board1: BoardState,
  _player1Id: string,
  board2: BoardState,
  _player2Id: string
): BoardState {
  const battleBoard = createEmptyBoard();
  battleBoard.size = { width: BOARD_WIDTH, height: BOARD_HEIGHT * 2 };

  // Player 1's pieces go on bottom half (facing up)
  for (const piece of Object.values(board1.pieces)) {
    if (piece.position) {
      const newPos = { x: piece.position.x, y: piece.position.y + BOARD_HEIGHT };
      const newPiece = { ...piece, facingUp: true };
      battleBoard.pieces[piece.id] = { ...newPiece, position: newPos };
      battleBoard.piecePositions[positionToKey(newPos)] = piece.id;
    }
  }

  // Player 2's pieces go on top half (facing down), mirrored
  for (const piece of Object.values(board2.pieces)) {
    if (piece.position) {
      const newPos = { 
        x: BOARD_WIDTH - 1 - piece.position.x,  // Mirror horizontally
        y: BOARD_HEIGHT - 1 - piece.position.y  // Place on top half
      };
      const newPiece = { ...piece, facingUp: false };
      battleBoard.pieces[piece.id] = { ...newPiece, position: newPos };
      battleBoard.piecePositions[positionToKey(newPos)] = piece.id;
    }
  }

  return battleBoard;
}

