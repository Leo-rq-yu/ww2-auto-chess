import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BoardState, Position, Piece, BOARD_WIDTH, BOARD_HEIGHT } from '../../types';
import { UnitCard } from './UnitCard';
import { positionToKey } from '../../engine/board';

interface BoardGridProps {
  board: BoardState;
  playerId: string;
  selectedPieceId: string | null;
  onTileClick: (position: Position) => void;
  onPieceClick: (pieceId: string) => void;
  onPieceRightClick?: (pieceId: string) => void;
  onPieceHover?: (piece: Piece | null) => void;
  isPreparation: boolean;
  highlightedTiles?: Position[];
}

export function BoardGrid({
  board,
  playerId,
  selectedPieceId,
  onTileClick,
  onPieceClick,
  onPieceRightClick,
  onPieceHover,
  isPreparation,
  highlightedTiles = [],
}: BoardGridProps) {
  // Generate grid cells
  const grid = useMemo(() => {
    const cells: { position: Position; isPlayerSide: boolean }[] = [];

    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        cells.push({
          position: { x, y },
          isPlayerSide: y >= BOARD_HEIGHT / 2, // Bottom half is player's side
        });
      }
    }

    return cells;
  }, []);

  const highlightedSet = useMemo(() => {
    return new Set(highlightedTiles.map(p => positionToKey(p)));
  }, [highlightedTiles]);

  return (
    <div
      className="relative bg-gradient-to-b from-stone-900 to-stone-950 rounded-xl p-2 border-2 border-stone-700"
      style={{
        backgroundImage: `
          linear-gradient(to bottom, rgba(28, 25, 23, 0.95), rgba(12, 10, 9, 0.95)),
          url('/images/grid-pattern.svg')
        `,
        backgroundSize: '100% 100%, 60px 60px',
      }}
    >
      {/* Grid */}
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
          gridTemplateRows: `repeat(${BOARD_HEIGHT}, 1fr)`,
        }}
      >
        {grid.map(({ position, isPlayerSide }) => {
          const key = positionToKey(position);
          const pieceId = board.piecePositions[key];
          const piece = pieceId ? board.pieces[pieceId] : null;
          const isHighlighted = highlightedSet.has(key);
          const isOwnedPiece = piece && piece.ownerId === playerId;
          const canPlace = isPreparation && isPlayerSide && !piece;
          const canInteract = isPreparation && isOwnedPiece;

          return (
            <motion.div
              key={key}
              className={`
                relative aspect-square rounded-lg border-2 transition-all duration-200
                ${
                  isPlayerSide
                    ? 'bg-stone-800/60 border-stone-600/50'
                    : 'bg-stone-900/40 border-stone-700/30'
                }
                ${isHighlighted ? 'bg-amber-500/30 border-amber-400' : ''}
                ${canPlace && !piece ? 'hover:bg-amber-500/20 hover:border-amber-500/50 cursor-pointer' : ''}
                ${!isPlayerSide && isPreparation ? 'cursor-not-allowed opacity-50' : ''}
              `}
              onClick={() => {
                if (piece && (canInteract || !isPreparation)) {
                  onPieceClick(piece.id);
                } else if (canPlace) {
                  onTileClick(position);
                }
              }}
              onMouseEnter={() => piece && onPieceHover?.(piece)}
              onMouseLeave={() => onPieceHover?.(null)}
              whileHover={canPlace ? { scale: 1.02 } : undefined}
            >
              {/* Grid coordinate (debug) */}
              <div className="absolute top-0.5 left-0.5 text-[8px] text-stone-600 font-mono opacity-50">
                {position.x},{position.y}
              </div>

              {/* Piece */}
              <AnimatePresence mode="popLayout">
                {piece && (
                  <motion.div
                    key={piece.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="absolute inset-1 flex items-center justify-center"
                  >
                    <UnitCard
                      piece={piece}
                      selected={selectedPieceId === piece.id}
                      onClick={() => onPieceClick(piece.id)}
                      onRightClick={() => onPieceRightClick?.(piece.id)}
                      size="sm"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Enemy side indicator line */}
              {position.y === BOARD_HEIGHT / 2 - 1 && (
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-red-500/30" />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Side labels */}
      <div className="absolute -left-8 top-1/4 text-stone-500 text-xs font-bold transform -rotate-90">
        Enemy
      </div>
      <div className="absolute -left-8 bottom-1/4 text-amber-500 text-xs font-bold transform -rotate-90">
        Ally
      </div>
    </div>
  );
}

export default BoardGrid;
