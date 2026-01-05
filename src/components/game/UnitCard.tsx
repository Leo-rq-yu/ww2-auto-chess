import { motion } from 'motion/react';
import { Piece, ShopCard } from '../../types';
import { UNIT_DEFINITIONS, TRAIT_DEFINITIONS } from '../../types/units';
import { Star, Shield, Sword, Zap, Coins } from 'lucide-react';

interface UnitCardProps {
  piece?: Piece;
  shopCard?: ShopCard;
  onClick?: () => void;
  onRightClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  showPrice?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-16 h-20',
  md: 'w-24 h-32',
  lg: 'w-32 h-44',
};

const imageSizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
};

const rarityColors: Record<number, string> = {
  1: 'from-stone-600 to-stone-700 border-stone-500',
  2: 'from-emerald-800 to-emerald-900 border-emerald-500',
  3: 'from-amber-700 to-amber-900 border-amber-400',
};

const starColors: Record<number, string> = {
  1: 'text-stone-400',
  2: 'text-emerald-400',
  3: 'text-amber-400',
};

export function UnitCard({
  piece,
  shopCard,
  onClick,
  onRightClick,
  selected = false,
  disabled = false,
  showPrice = false,
  size = 'md',
}: UnitCardProps) {
  const typeId = piece?.typeId || shopCard?.typeId;
  if (!typeId) return null;

  const def = UNIT_DEFINITIONS[typeId];
  if (!def) return null;

  const level = piece?.level || 1;
  const cost = shopCard?.cost || def.cost;
  const traits = piece?.traits || shopCard?.traits || [];

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onRightClick?.();
  };

  const handleClick = () => {
    console.log('[UnitCard] Card clicked, disabled:', disabled, 'onClick:', !!onClick);
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <motion.div
      whileHover={!disabled ? { scale: 1.05, y: -4 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`
        relative ${sizeClasses[size]} rounded-lg overflow-hidden cursor-pointer
        bg-gradient-to-b ${rarityColors[cost]} border-2
        ${selected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-stone-900' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
        shadow-lg shadow-black/30
      `}
    >
      {/* Unit Image */}
      <div className="absolute inset-0 flex items-center justify-center p-1">
        <img
          src={def.imageUrl}
          alt={def.name}
          className={`${imageSizeClasses[size]} object-contain drop-shadow-lg`}
        />
      </div>

      {/* Stars */}
      <div className="absolute top-0.5 left-0.5 flex gap-0.5">
        {Array.from({ length: level }).map((_, i) => (
          <Star
            key={i}
            size={size === 'sm' ? 8 : size === 'md' ? 10 : 14}
            className={`${starColors[level]} fill-current`}
          />
        ))}
      </div>

      {/* Traits Badge */}
      {traits.length > 0 && size !== 'sm' && (
        <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
          {traits.slice(0, 2).map((trait, i) => {
            const traitDef = TRAIT_DEFINITIONS[trait.traitId];
            return (
              <div
                key={i}
                className="bg-purple-600/80 text-[8px] px-1 rounded text-white font-bold"
                title={traitDef?.description}
              >
                {traitDef?.name?.charAt(0)}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
        <div className="text-[8px] font-bold text-center text-white truncate">
          {def.name}
        </div>
        
        {/* Stats (for larger sizes) */}
        {size !== 'sm' && piece && (
          <div className="flex justify-center gap-1 text-[7px] text-stone-300">
            <span className="flex items-center gap-0.5">
              <Shield size={8} className="text-blue-400" />
              {piece.defense}
            </span>
            <span className="flex items-center gap-0.5">
              <Sword size={8} className="text-red-400" />
              {piece.attackMin}-{piece.attackMax}
            </span>
            <span className="flex items-center gap-0.5">
              <Zap size={8} className="text-yellow-400" />
              {piece.speed}
            </span>
          </div>
        )}

        {/* Price */}
        {showPrice && (
          <div className="flex items-center justify-center gap-0.5 text-amber-400 font-bold text-[10px]">
            <Coins size={10} />
            {cost}
          </div>
        )}
      </div>

      {/* HP Bar (for battle pieces) */}
      {piece && piece.currentHp !== undefined && piece.maxHp && (
        <div className="absolute bottom-6 left-1 right-1 h-1 bg-black/50 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              piece.currentHp / piece.maxHp > 0.5
                ? 'bg-green-500'
                : piece.currentHp / piece.maxHp > 0.25
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${(piece.currentHp / piece.maxHp) * 100}%` }}
          />
        </div>
      )}

      {/* Fortification Indicator */}
      {piece?.fortification && piece.fortification.remainingTurns > 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Shield size={size === 'sm' ? 16 : 24} className="text-blue-400/50" />
        </div>
      )}
    </motion.div>
  );
}

export default UnitCard;

