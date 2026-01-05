import { 
  BoardState, 
  Piece, 
  Position, 
  BattleEvent, 
  BattleResult,
  PieceCombatInfo,
} from '../types';
import { UNIT_DEFINITIONS } from '../types/units';
import { 
  getPiecePosition, 
  isInAttackRange, 
  getAlivePieces,
  getAlivePiecesByOwner,
  movePiece,
  getRadiusAoePositions,
  getLineSweepPositions,
  getPieceAtPosition,
  positionToKey
} from './board';
import { Pathfinder, findNearestEnemy, findEnemyInRange, getNextPiecePosition } from './pathfinding';

// =============================================
// Battle Simulation Engine
// =============================================

const DYING_DURATION = 10;
const INITIAL_MOVE_DELAY = 15;
const INITIAL_ATTACK_DELAY = 15;
const ATTACK_COOLDOWN = 20;
const MOVE_COOLDOWN = 10;

export interface BattleState {
  board: BoardState;
  combatInfo: Map<string, PieceCombatInfo>;
  events: BattleEvent[];
  turn: number;
  isFinished: boolean;
}

// Initialize combat info for all pieces
function initializeCombatInfo(board: BoardState): Map<string, PieceCombatInfo> {
  const combatInfo = new Map<string, PieceCombatInfo>();
  
  for (const piece of Object.values(board.pieces)) {
    combatInfo.set(piece.id, {
      state: { type: 'wandering' },
      canMoveAtTurn: INITIAL_MOVE_DELAY,
      canBeAttackedAtTurn: 0,
      canAttackAtTurn: INITIAL_ATTACK_DELAY,
    });
  }
  
  return combatInfo;
}

// Calculate damage with all modifiers
function calculateDamage(
  attacker: Piece,
  defender: Piece,
  _attackerDef: typeof UNIT_DEFINITIONS[string],
  defenderDef: typeof UNIT_DEFINITIONS[string]
): number {
  // Base damage is random between min and max
  const baseDamage = attacker.attackMin + Math.floor(Math.random() * (attacker.attackMax - attacker.attackMin + 1));
  let damage = baseDamage;

  // Apply bonus damage based on unit type matchups
  // Armored car vs infantry: +1
  if (attacker.typeId === 'armored_car' && defender.typeId === 'infantry') {
    damage += 1;
  }
  // Tank vs armored car: +1
  if (attacker.typeId === 'tank' && defender.typeId === 'armored_car') {
    damage += 1;
  }
  // Anti-air vs aircraft: bonus damage (4-5 instead of 2-3)
  if (attacker.typeId === 'anti_air' && defender.typeId === 'aircraft') {
    damage += 2;  // Additional +2 to reach 4-5 damage
  }
  // Anti-air vs heavy armor: half damage
  if (attacker.typeId === 'anti_air' && (defender.typeId === 'tank' || defender.typeId === 'armored_car')) {
    damage = Math.floor(damage / 2);
  }

  // Apply trait bonuses
  for (const trait of attacker.traits) {
    switch (trait.traitId) {
      case 'armor_pierce':
        // Bonus damage vs armor units
        if (defenderDef.traits.includes('armor')) {
          damage += trait.level;
        }
        break;
      case 'heavy_cannon':
        damage += trait.level;
        break;
    }
  }

  // Apply defense reduction
  let effectiveDefense = defender.defense;
  
  // Fortification armor
  if (defender.fortification && defender.fortification.remainingTurns > 0) {
    effectiveDefense += defender.fortification.armor;
  }

  damage = Math.max(1, damage - effectiveDefense);

  // Aircraft dodge chance from synergy
  if (defender.typeId === 'aircraft') {
    // Check for air synergy dodge (handled elsewhere)
  }

  return damage;
}

// Check if attacker can attack defender (type restrictions)
function canAttack(attacker: Piece, defender: Piece): boolean {
  // Artillery cannot attack aircraft
  if (attacker.typeId === 'artillery' && defender.typeId === 'aircraft') {
    return false;
  }
  
  // Engineer cannot attack
  if (attacker.typeId === 'engineer') {
    return false;
  }

  return true;
}

// Process attack action
function processAttack(
  state: BattleState,
  attacker: Piece,
  attackerPos: Position,
  target: Piece,
  targetPos: Position
): BattleState {
  const attackerDef = UNIT_DEFINITIONS[attacker.typeId];
  const defenderDef = UNIT_DEFINITIONS[target.typeId];
  
  if (!canAttack(attacker, target)) {
    return state;
  }

  const events: BattleEvent[] = [...state.events];
  let board = { ...state.board, pieces: { ...state.board.pieces } };

  // Determine attack targets based on attack type
  let targets: { piece: Piece; pos: Position }[] = [];

  switch (attackerDef.attackType) {
    case 'melee':
    case 'ranged':
      targets = [{ piece: target, pos: targetPos }];
      break;
      
    case 'aoe_radius':
      // Hit target and adjacent positions
      const aoePositions = getRadiusAoePositions(targetPos, board);
      for (const pos of aoePositions) {
        const pieceAtPos = getPieceAtPosition(pos, board);
        // AOE doesn't hit aircraft (for artillery)
        if (pieceAtPos && pieceAtPos.ownerId !== attacker.ownerId && 
            !(attacker.typeId === 'artillery' && pieceAtPos.typeId === 'aircraft')) {
          targets.push({ piece: pieceAtPos, pos });
        }
      }
      break;
      
    case 'line_sweep':
      // Determine sweep direction based on facing
      const direction = attacker.facingUp ? 'vertical' : 'horizontal';
      const sweepPositions = getLineSweepPositions(attackerPos, direction, attacker.range, board);
      for (const pos of sweepPositions) {
        const pieceAtPos = getPieceAtPosition(pos, board);
        if (pieceAtPos && pieceAtPos.ownerId !== attacker.ownerId) {
          targets.push({ piece: pieceAtPos, pos });
        }
      }
      // Also include primary target
      if (!targets.find(t => t.piece.id === target.id)) {
        targets.push({ piece: target, pos: targetPos });
      }
      break;
  }

  // Apply damage to all targets
  for (const { piece: targetPiece, pos } of targets) {
    const damage = calculateDamage(attacker, targetPiece, attackerDef, UNIT_DEFINITIONS[targetPiece.typeId]);
    const newHp = Math.max(0, targetPiece.currentHp - damage);

    board.pieces[targetPiece.id] = {
      ...board.pieces[targetPiece.id],
      currentHp: newHp,
    };

    // Attack event
    events.push({
      turn: state.turn,
      type: 'attack',
      pieceId: attacker.id,
      targetId: targetPiece.id,
      from: attackerPos,
      to: pos,
      damage,
    });

    // Hit event
    events.push({
      turn: state.turn,
      type: 'hit',
      pieceId: targetPiece.id,
      damage,
    });

    // Death event if HP reaches 0
    if (newHp <= 0) {
      events.push({
        turn: state.turn,
        type: 'death',
        pieceId: targetPiece.id,
      });
    }
  }

  // Check for blitz trait (extra attack chance)
  for (const trait of attacker.traits) {
    if (trait.traitId === 'blitz') {
      const chance = 0.30 * trait.level;
      if (Math.random() < chance) {
        // Recursive call for extra attack (be careful with infinite loops)
        // For now, just add bonus damage to first target
        const bonusDamage = Math.floor(calculateDamage(attacker, target, attackerDef, defenderDef) * 0.5);
        if (targets.length > 0) {
          const firstTarget = targets[0].piece;
          const currentHp = board.pieces[firstTarget.id].currentHp;
          board.pieces[firstTarget.id] = {
            ...board.pieces[firstTarget.id],
            currentHp: Math.max(0, currentHp - bonusDamage),
          };
          events.push({
            turn: state.turn,
            type: 'attack',
            pieceId: attacker.id,
            targetId: firstTarget.id,
            damage: bonusDamage,
          });
        }
      }
    }
  }

  return { ...state, board, events };
}

// Process movement action
function processMovement(
  state: BattleState,
  piece: Piece,
  fromPos: Position,
  toPos: Position
): BattleState {
  const events: BattleEvent[] = [...state.events];
  const board = movePiece(state.board, piece.id, toPos);

  events.push({
    turn: state.turn,
    type: 'move',
    pieceId: piece.id,
    from: fromPos,
    to: toPos,
  });

  return { ...state, board, events };
}

// Simulate one piece's turn
function simulatePieceTurn(
  state: BattleState,
  piece: Piece,
  piecePos: Position,
  pathfinder: Pathfinder
): BattleState {
  const combatInfo = state.combatInfo.get(piece.id);
  if (!combatInfo || piece.currentHp <= 0) {
    return state;
  }

  // Check if piece is dying
  if (combatInfo.state.type === 'dying') {
    if (state.turn >= (combatInfo.state.dieAtTurn || 0)) {
      // Remove piece from board
      const newPositions = { ...state.board.piecePositions };
      const posKey = positionToKey(piecePos);
      delete newPositions[posKey];
      
      return {
        ...state,
        board: {
          ...state.board,
          piecePositions: newPositions,
        },
      };
    }
    return state;
  }

  // Handle dead pieces (not already marked as dying)
  if (piece.currentHp <= 0) {
    const newCombatInfo = new Map(state.combatInfo);
    newCombatInfo.set(piece.id, {
      ...combatInfo,
      state: { type: 'dying', dieAtTurn: state.turn + DYING_DURATION },
    });
    return { ...state, combatInfo: newCombatInfo };
  }

  // Engineer provides fortification instead of attacking
  if (piece.typeId === 'engineer') {
    return handleEngineerTurn(state, piece, piecePos);
  }

  // Find target
  let target: { piece: Piece; position: Position } | null = null;

  // If already attacking someone, continue attacking them if they're alive and in range
  if (combatInfo.state.type === 'attacking' && combatInfo.state.targetId) {
    const targetPiece = state.board.pieces[combatInfo.state.targetId];
    if (targetPiece && targetPiece.currentHp > 0) {
      const targetPos = getPiecePosition(targetPiece.id, state.board);
      if (targetPos && isInAttackRange(piecePos, targetPos, piece.range)) {
        target = { piece: targetPiece, position: targetPos };
      }
    }
  }

  // If no current target, find new one in range
  if (!target) {
    target = findEnemyInRange(state.board, piece, piecePos, piece.range);
  }

  // If target in range and can attack, attack
  if (target && state.turn >= combatInfo.canAttackAtTurn) {
    const newCombatInfo = new Map(state.combatInfo);
    newCombatInfo.set(piece.id, {
      ...combatInfo,
      state: { type: 'attacking', targetId: target.piece.id },
      canAttackAtTurn: state.turn + ATTACK_COOLDOWN,
    });
    
    let newState = { ...state, combatInfo: newCombatInfo };
    newState = processAttack(newState, piece, piecePos, target.piece, target.position);
    return newState;
  }

  // If no target in range, find nearest enemy and move towards them
  const nearestEnemy = findNearestEnemy(state.board, piece, piecePos);
  
  if (nearestEnemy && state.turn >= combatInfo.canMoveAtTurn && piece.speed > 0) {
    const nextPos = getNextPiecePosition(
      pathfinder,
      piecePos,
      piece.facingUp,
      piece.range,
      nearestEnemy.position,
      state.board
    );

    if (nextPos) {
      const newCombatInfo = new Map(state.combatInfo);
      newCombatInfo.set(piece.id, {
        ...combatInfo,
        canMoveAtTurn: state.turn + MOVE_COOLDOWN,
      });
      
      let newState = { ...state, combatInfo: newCombatInfo };
      newState = processMovement(newState, piece, piecePos, nextPos);
      return newState;
    }
  }

  return state;
}

// Handle engineer's fortification ability
function handleEngineerTurn(
  state: BattleState,
  engineer: Piece,
  engineerPos: Position
): BattleState {
  // Find friendly units adjacent to engineer (not aircraft)
  const board = { ...state.board, pieces: { ...state.board.pieces } };
  const events: BattleEvent[] = [...state.events];
  
  const directions = [
    { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
  ];

  for (const dir of directions) {
    const adjPos = { x: engineerPos.x + dir.x, y: engineerPos.y + dir.y };
    const adjPiece = getPieceAtPosition(adjPos, board);
    
    if (adjPiece && adjPiece.ownerId === engineer.ownerId && adjPiece.typeId !== 'aircraft') {
      // Calculate fortification strength based on engineer's star level
      const fortificationArmor = engineer.level;  // 1/2/3 based on stars
      const fortificationDuration = 2 + engineer.level;  // 3/4/5 turns

      // Apply or refresh fortification
      board.pieces[adjPiece.id] = {
        ...board.pieces[adjPiece.id],
        fortification: {
          armor: fortificationArmor,
          remainingTurns: fortificationDuration,
        },
      };

      events.push({
        turn: state.turn,
        type: 'fortification',
        pieceId: engineer.id,
        targetId: adjPiece.id,
      });
    }
  }

  return { ...state, board, events };
}

// Decrement fortification turns
function updateFortifications(state: BattleState): BattleState {
  const board = { ...state.board, pieces: { ...state.board.pieces } };
  
  for (const piece of Object.values(board.pieces)) {
    if (piece.fortification && piece.fortification.remainingTurns > 0) {
      board.pieces[piece.id] = {
        ...board.pieces[piece.id],
        fortification: {
          ...piece.fortification,
          remainingTurns: piece.fortification.remainingTurns - 1,
        },
      };
    }
  }
  
  return { ...state, board };
}

// Check if battle is over
function isBattleOver(board: BoardState): boolean {
  const alivePieces = getAlivePieces(board);
  if (alivePieces.length === 0) return true;

  // Check if all alive pieces belong to one owner
  const owners = new Set(alivePieces.map(p => p.ownerId));
  return owners.size <= 1;
}

// Simulate one turn
export function simulateTurn(state: BattleState): BattleState {
  if (state.isFinished) return state;

  const pathfinder = new Pathfinder(state.board.size);
  let newState = { ...state, turn: state.turn + 1 };

  // Update fortifications
  newState = updateFortifications(newState);

  // Get all alive pieces sorted by speed (faster goes first)
  const alivePieces = getAlivePieces(newState.board).sort((a, b) => b.speed - a.speed);

  // Each piece takes its turn
  for (const piece of alivePieces) {
    const pos = getPiecePosition(piece.id, newState.board);
    if (pos && piece.currentHp > 0) {
      newState = simulatePieceTurn(newState, newState.board.pieces[piece.id], pos, pathfinder);
    }
  }

  // Check if battle is over
  if (isBattleOver(newState.board)) {
    newState.isFinished = true;
  }

  return newState;
}

// Initialize battle state
export function initializeBattle(board: BoardState): BattleState {
  return {
    board,
    combatInfo: initializeCombatInfo(board),
    events: [],
    turn: 0,
    isFinished: false,
  };
}

// Run complete battle simulation
export function runBattle(board: BoardState, maxTurns: number = 200): BattleState {
  let state = initializeBattle(board);
  
  while (!state.isFinished && state.turn < maxTurns) {
    state = simulateTurn(state);
  }
  
  return state;
}

// Calculate battle result
export function calculateBattleResult(
  state: BattleState,
  player1Id: string,
  player2Id: string
): BattleResult {
  const player1Survivors = getAlivePiecesByOwner(state.board, player1Id);
  const player2Survivors = getAlivePiecesByOwner(state.board, player2Id);

  const player1SurvivorCount = player1Survivors.length;
  const player2SurvivorCount = player2Survivors.length;

  // Calculate damage based on surviving units' total attack
  const player1TotalAttack = player1Survivors.reduce(
    (sum, p) => sum + Math.floor((p.attackMin + p.attackMax) / 2), 
    0
  );
  const player2TotalAttack = player2Survivors.reduce(
    (sum, p) => sum + Math.floor((p.attackMin + p.attackMax) / 2), 
    0
  );

  // Determine winner
  if (player1SurvivorCount > 0 && player2SurvivorCount === 0) {
    return {
      winnerId: player1Id,
      loserId: player2Id,
      winnerSurvivors: player1SurvivorCount,
      loserSurvivors: 0,
      damageDealt: player1TotalAttack,
      isDraw: false,
    };
  } else if (player2SurvivorCount > 0 && player1SurvivorCount === 0) {
    return {
      winnerId: player2Id,
      loserId: player1Id,
      winnerSurvivors: player2SurvivorCount,
      loserSurvivors: 0,
      damageDealt: player2TotalAttack,
      isDraw: false,
    };
  } else {
    // Draw - both deal damage based on survivors
    return {
      winnerId: null,
      loserId: null,
      winnerSurvivors: Math.max(player1SurvivorCount, player2SurvivorCount),
      loserSurvivors: Math.min(player1SurvivorCount, player2SurvivorCount),
      damageDealt: 5,  // Fixed draw damage
      isDraw: true,
    };
  }
}

