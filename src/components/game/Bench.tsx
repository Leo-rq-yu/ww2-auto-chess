import { motion, AnimatePresence } from 'motion/react';
import { Piece, BENCH_SIZE } from '../../types';
import { UnitCard } from './UnitCard';

interface BenchProps {
  pieces: Piece[];
  selectedPieceId: string | null;
  onPieceClick: (pieceId: string) => void;
  onPieceRightClick?: (pieceId: string) => void;
  onPieceHover?: (piece: Piece | null) => void;
  onEmptySlotClick?: (slot: number) => void;
}

export function Bench({
  pieces,
  selectedPieceId,
  onPieceClick,
  onPieceRightClick,
  onPieceHover,
  onEmptySlotClick,
}: BenchProps) {
  // Create slot array with pieces
  const slots = Array.from({ length: BENCH_SIZE }, (_, i) => {
    return pieces.find(p => p.benchSlot === i) || null;
  });

  return (
    <div className="bg-stone-800/80 rounded-xl p-3 border-2 border-stone-700">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-stone-400 text-sm font-semibold">Bench</span>
        <span className="text-stone-500 text-xs">
          ({pieces.length}/{BENCH_SIZE})
        </span>
      </div>
      
      <div className="flex gap-2">
        {slots.map((piece, index) => (
          <motion.div
            key={index}
            className={`
              w-16 h-20 rounded-lg border-2 border-dashed
              flex items-center justify-center
              transition-colors duration-200
              ${piece 
                ? 'border-transparent bg-transparent' 
                : 'border-stone-600 bg-stone-900/50 hover:border-amber-500/50 hover:bg-amber-500/10 cursor-pointer'
              }
            `}
            onClick={() => {
              if (piece) {
                onPieceClick(piece.id);
              } else {
                onEmptySlotClick?.(index);
              }
            }}
            onMouseEnter={() => piece && onPieceHover?.(piece)}
            onMouseLeave={() => onPieceHover?.(null)}
            whileHover={!piece ? { scale: 1.05 } : undefined}
          >
            <AnimatePresence mode="popLayout">
              {piece ? (
                <motion.div
                  key={piece.id}
                  initial={{ scale: 0, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0, y: -20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <UnitCard
                    piece={piece}
                    selected={selectedPieceId === piece.id}
                    onClick={() => onPieceClick(piece.id)}
                    onRightClick={() => onPieceRightClick?.(piece.id)}
                    size="sm"
                  />
                </motion.div>
              ) : (
                <span className="text-stone-600 text-2xl">+</span>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default Bench;
