import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShopState, ShopCard as ShopCardType } from '../../types';
import { UnitCard } from './UnitCard';
import { UnitDetailCard } from './UnitDetailCard';
import { Button } from '../ui/Button';
import { RefreshCw, Lock, Unlock, Coins } from 'lucide-react';

interface ShopProps {
  shop: ShopState;
  playerMoney: number;
  onBuyCard: (index: number) => void;
  onRefresh: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
}

export function Shop({
  shop,
  playerMoney,
  onBuyCard,
  onRefresh,
  isLocked = false,
  onToggleLock,
}: ShopProps) {
  const canRefresh = playerMoney >= shop.refreshCost && !isLocked;
  const [hoveredCard, setHoveredCard] = useState<ShopCardType | null>(null);

  return (
    <div className="w-[356px] bg-stone-800/80 rounded-xl border-2 border-stone-700">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-stone-700">
        <div className="flex items-center gap-3">
          <h3 className="text-amber-400 font-bold text-lg">Shop</h3>
          
          {/* Lock Button */}
          <button
            onClick={onToggleLock}
            className={`
              p-1.5 rounded-lg transition-all duration-200
              ${isLocked 
                ? 'bg-amber-500/30 text-amber-400 ring-2 ring-amber-500/50' 
                : 'bg-stone-700 text-stone-400 hover:text-stone-200 hover:bg-stone-600'
              }
            `}
            title={isLocked ? 'Unlock Shop (cards will refresh next round)' : 'Lock Shop (keep these cards)'}
          >
            {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
          
          {isLocked && (
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
              Locked
            </span>
          )}
        </div>

        {/* Refresh Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={!canRefresh}
          className="flex items-center gap-2"
        >
          <RefreshCw size={14} className={isLocked ? 'opacity-50' : ''} />
          <span>Refresh</span>
          <span className="flex items-center gap-0.5 text-amber-400">
            <Coins size={12} />
            {shop.refreshCost}
          </span>
        </Button>
      </div>

      {/* Cards - 2 rows of cards */}
      <div className="p-3">
        <div className="grid grid-cols-3 gap-2">
          <AnimatePresence mode="popLayout">
            {shop.cards.slice(0, 6).map((card, index) => (
              <motion.div
                key={`${card.typeId}-${index}`}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ 
                  type: 'spring', 
                  stiffness: 400, 
                  damping: 25,
                  delay: index * 0.03 
                }}
                onMouseEnter={() => !card.purchased && setHoveredCard(card)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {card.purchased ? (
                  <div className="aspect-[3/4] rounded-lg border-2 border-dashed border-stone-600 bg-stone-900/50 flex items-center justify-center">
                    <span className="text-stone-600 text-xs">Sold</span>
                  </div>
                ) : (
                  <UnitCard
                    shopCard={card}
                    showPrice
                    disabled={playerMoney < card.cost}
                    onClick={() => onBuyCard(index)}
                    size="md"
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Hint */}
      <div className="px-3 pb-3 text-center text-stone-500 text-xs">
        Click to buy · Hover for details · Press D to sell
      </div>

      {/* Unit Detail Card - Shows on hover */}
      <UnitDetailCard 
        shopCard={hoveredCard} 
        visible={!!hoveredCard}
      />
    </div>
  );
}

export default Shop;
