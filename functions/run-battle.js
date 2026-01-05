/**
 * Edge Function: run-battle
 * 
 * Calculates one turn of battle result
 * Frontend loops and calls this for each turn
 * 
 * Input:
 * - matchId: string
 * - turn: number (current turn number)
 * - battleBoard: { pieces, piecePositions, size } - current board state
 * - player1Id: string
 * - player2Id: string
 * 
 * Output:
 * - updatedBoard: updated board state
 * - events: events that occurred this turn (move, attack, death, etc.)
 * - isFinished: whether battle has ended
 * - result: if finished, contains win/loss result
 */

const BOARD_WIDTH = 6;
const BOARD_HEIGHT = 6;

// Helper functions
function positionToKey(pos) {
  return `${pos.x},${pos.y}`;
}

function keyToPosition(key) {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

function getPiecePosition(pieceId, board) {
  for (const [key, id] of Object.entries(board.piecePositions)) {
    if (id === pieceId) {
      return keyToPosition(key);
    }
  }
  return null;
}

function getPieceAtPosition(pos, board) {
  const key = positionToKey(pos);
  const pieceId = board.piecePositions[key];
  return pieceId ? board.pieces[pieceId] : null;
}

function isInAttackRange(attackerPos, targetPos, range) {
  const dx = Math.abs(attackerPos.x - targetPos.x);
  const dy = Math.abs(attackerPos.y - targetPos.y);
  return Math.max(dx, dy) <= range;
}

function getAlivePieces(board) {
  return Object.values(board.pieces).filter(p => p.currentHp > 0);
}

function getAlivePiecesByOwner(board, ownerId) {
  return getAlivePieces(board).filter(p => p.ownerId === ownerId);
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Find nearest enemy
function findNearestEnemy(board, piece, pos) {
  let nearest = null;
  let nearestDist = Infinity;
  
  for (const other of getAlivePieces(board)) {
    if (other.ownerId !== piece.ownerId) {
      const otherPos = getPiecePosition(other.id, board);
      if (otherPos) {
        const dist = heuristic(pos, otherPos);
        if (dist < nearestDist) {
          nearest = { piece: other, position: otherPos };
          nearestDist = dist;
        }
      }
    }
  }
  
  return nearest;
}

// Find enemy in attack range
function findEnemyInRange(board, piece, pos, range) {
  for (const other of getAlivePieces(board)) {
    if (other.ownerId !== piece.ownerId) {
      const otherPos = getPiecePosition(other.id, board);
      if (otherPos && isInAttackRange(pos, otherPos, range)) {
        return { piece: other, position: otherPos };
      }
    }
  }
  return null;
}

// Simple pathfinding - find next step towards target
function findNextStep(from, to, board) {
  // Simple approach: move in the direction that reduces distance
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  const candidates = [];
  
  if (dx !== 0) {
    candidates.push({ x: from.x + Math.sign(dx), y: from.y });
  }
  if (dy !== 0) {
    candidates.push({ x: from.x, y: from.y + Math.sign(dy) });
  }
  
  // Find first unoccupied candidate
  for (const candidate of candidates) {
    if (candidate.x >= 0 && candidate.x < BOARD_WIDTH &&
        candidate.y >= 0 && candidate.y < BOARD_HEIGHT) {
      const pieceAtPos = getPieceAtPosition(candidate, board);
      if (!pieceAtPos) {
        return candidate;
      }
    }
  }
  
  return null;
}

// Calculate damage
function calculateDamage(attacker, defender) {
  const min = attacker.attackMin || 1;
  const max = attacker.attackMax || 3;
  const baseDamage = min + Math.floor(Math.random() * (max - min + 1));
  let damage = baseDamage;
  
  // Type matchup bonuses
  if (attacker.typeId === 'armored_car' && defender.typeId === 'infantry') damage += 1;
  if (attacker.typeId === 'tank' && defender.typeId === 'armored_car') damage += 1;
  if (attacker.typeId === 'anti_air' && defender.typeId === 'aircraft') damage += 2;
  if (attacker.typeId === 'anti_air' && (defender.typeId === 'tank' || defender.typeId === 'armored_car')) {
    damage = Math.floor(damage / 2);
  }
  
  // Defense reduction
  const defense = defender.defense || 0;
  damage = Math.max(1, damage - defense);
  
  return damage;
}

// Check if battle is over
function isBattleOver(board) {
  const alivePieces = getAlivePieces(board);
  if (alivePieces.length === 0) return true;
  
  const owners = new Set(alivePieces.map(p => p.ownerId));
  return owners.size <= 1;
}

// Calculate battle result
function calculateBattleResult(board, player1Id, player2Id) {
  const player1Survivors = getAlivePiecesByOwner(board, player1Id);
  const player2Survivors = getAlivePiecesByOwner(board, player2Id);
  
  const player1Count = player1Survivors.length;
  const player2Count = player2Survivors.length;
  
  // Calculate damage based on survivors
  const damageDealt = Math.max(1, player1Count > player2Count ? player1Count : player2Count);
  
  if (player1Count > 0 && player2Count === 0) {
    return {
      winnerId: player1Id,
      loserId: player2Id,
      winnerSurvivors: player1Count,
      loserSurvivors: 0,
      damageDealt,
      isDraw: false,
    };
  } else if (player2Count > 0 && player1Count === 0) {
    return {
      winnerId: player2Id,
      loserId: player1Id,
      winnerSurvivors: player2Count,
      loserSurvivors: 0,
      damageDealt,
      isDraw: false,
    };
  } else {
    return {
      winnerId: null,
      loserId: null,
      winnerSurvivors: Math.max(player1Count, player2Count),
      loserSurvivors: Math.min(player1Count, player2Count),
      damageDealt: 2,
      isDraw: true,
    };
  }
}

/**
 * Process one turn of battle
 * @param {Object} board - current board state
 * @param {number} turn - current turn number
 * @returns {Object} - { updatedBoard, events }
 */
function processOneTurn(board, turn) {
  const events = [];
  
  // Clone board for mutation
  const updatedBoard = {
    pieces: JSON.parse(JSON.stringify(board.pieces)),
    piecePositions: { ...board.piecePositions },
    size: board.size,
  };
  
  // Get all alive pieces sorted by speed (higher speed acts first)
  const alivePieces = getAlivePieces(updatedBoard)
    .sort((a, b) => (b.speed || 1) - (a.speed || 1));
  
  // Each piece takes action
  for (const piece of alivePieces) {
    // Re-check if piece is still alive (might have died this turn)
    if (updatedBoard.pieces[piece.id].currentHp <= 0) continue;
    
    const pos = getPiecePosition(piece.id, updatedBoard);
    if (!pos) continue;
    
    const range = piece.range || 1;
    
    // Try to find enemy in range
    const targetInRange = findEnemyInRange(updatedBoard, piece, pos, range);
    
    if (targetInRange) {
      // Attack!
      const target = updatedBoard.pieces[targetInRange.piece.id];
      const damage = calculateDamage(piece, target);
      const newHp = Math.max(0, target.currentHp - damage);
      
      updatedBoard.pieces[target.id] = { ...target, currentHp: newHp };
      
      events.push({
        turn,
        type: 'attack',
        pieceId: piece.id,
        targetId: target.id,
        from: pos,
        to: targetInRange.position,
        damage,
      });
      
      if (newHp <= 0) {
        events.push({
          turn,
          type: 'death',
          pieceId: target.id,
          position: targetInRange.position,
        });
        
        // Remove from piecePositions
        delete updatedBoard.piecePositions[positionToKey(targetInRange.position)];
      }
    } else {
      // No enemy in range, try to move towards nearest enemy
      const nearestEnemy = findNearestEnemy(updatedBoard, piece, pos);
      
      if (nearestEnemy) {
        const nextStep = findNextStep(pos, nearestEnemy.position, updatedBoard);
        
        if (nextStep) {
          // Move piece
          delete updatedBoard.piecePositions[positionToKey(pos)];
          updatedBoard.piecePositions[positionToKey(nextStep)] = piece.id;
          
          events.push({
            turn,
            type: 'move',
            pieceId: piece.id,
            from: pos,
            to: nextStep,
          });
        }
      }
    }
  }
  
  return { updatedBoard, events };
}

// =============================================
// Edge Function Handler
// =============================================

module.exports = async function(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { matchId, turn, battleBoard, player1Id, player2Id } = body;

    if (!matchId || turn === undefined || !battleBoard || !player1Id || !player2Id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: matchId, turn, battleBoard, player1Id, player2Id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[run-battle] Turn ${turn} for match ${matchId.slice(0, 8)}`);

    // Process one turn
    const { updatedBoard, events } = processOneTurn(battleBoard, turn);
    
    // Check if battle is finished
    const isFinished = isBattleOver(updatedBoard);
    
    let result = null;
    if (isFinished) {
      result = calculateBattleResult(updatedBoard, player1Id, player2Id);
      console.log(`[run-battle] Battle finished: ${result.winnerId ? result.winnerId.slice(0, 8) + ' wins' : 'Draw'}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        turn,
        updatedBoard,
        events,
        isFinished,
        result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[run-battle] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
