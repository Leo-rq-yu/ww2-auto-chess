import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sword, Heart, Zap, Target, Footprints } from 'lucide-react';
import { Piece, ShopCard as ShopCardType, UnitTypeId } from '../../types';
import { UNIT_DEFINITIONS, TRAIT_DEFINITIONS } from '../../types/units';

interface UnitDetailCardProps {
  // Can accept either a Piece (from board/bench) or ShopCard (from shop)
  piece?: Piece | null;
  shopCard?: ShopCardType | null;
  visible: boolean;
}

export function UnitDetailCard({ piece, shopCard, visible }: UnitDetailCardProps) {
  // Determine what we're showing details for
  const typeId = piece?.typeId || shopCard?.typeId;
  const unitDef = typeId ? UNIT_DEFINITIONS[typeId as UnitTypeId] : null;
  
  // For pieces on board/bench, we use actual stats. For shop cards, use base stats
  const starLevel = piece?.level || 1;
  const hp = piece?.maxHp || unitDef?.baseHp || 0;
  const defense = piece?.defense || unitDef?.baseDefense || 0;
  const attackMin = piece?.attackMin || unitDef?.baseAttackMin || 0;
  const attackMax = piece?.attackMax || unitDef?.baseAttackMax || 0;
  const speed = piece?.speed || unitDef?.baseSpeed || 0;
  const range = piece?.range || unitDef?.baseRange || 0;
  
  // Traits from piece or shopCard
  const traits = piece?.traits || shopCard?.traits || [];

  if (!unitDef) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-4 right-4 w-80 bg-stone-900/95 backdrop-blur-lg rounded-xl border-2 border-amber-500/50 shadow-2xl shadow-black/50 z-50 overflow-hidden"
        >
          {/* Header with image */}
          <div className="relative h-24 bg-gradient-to-br from-stone-800 to-stone-900 p-3 flex items-center gap-3">
            <div className="w-16 h-16 bg-stone-700 rounded-lg flex items-center justify-center flex-shrink-0 border border-stone-600">
              <img 
                src={unitDef.imageUrl} 
                alt={unitDef.name}
                className="w-14 h-14 object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-amber-400 truncate">{unitDef.name}</h4>
                {starLevel > 1 && (
                  <span className="text-yellow-400 text-sm font-bold">{'★'.repeat(starLevel)}</span>
                )}
              </div>
              <p className="text-xs text-stone-400 line-clamp-2 mt-0.5">{unitDef.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded text-xs font-bold">
                  Cost: {unitDef.cost}
                </span>
                {unitDef.traits && unitDef.traits.map((trait, i) => (
                  <span key={i} className="bg-stone-600 text-stone-200 px-1.5 py-0.5 rounded text-xs capitalize">
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-3">
            <div className="grid grid-cols-3 gap-2">
              <StatBox icon={Heart} label="HP" value={hp} color="text-red-400" />
              <StatBox icon={Shield} label="DEF" value={defense} color="text-blue-400" />
              <StatBox icon={Sword} label="ATK" value={`${attackMin}-${attackMax}`} color="text-orange-400" />
              <StatBox icon={Zap} label="SPD" value={speed} color="text-yellow-400" />
              <StatBox icon={Target} label="RNG" value={range} color="text-green-400" />
              <StatBox icon={Footprints} label="MOV" value={speed} color="text-purple-400" />
            </div>
          </div>

          {/* Traits Section */}
          {traits.length > 0 && (
            <div className="px-3 pb-3">
              <h5 className="text-xs font-bold text-stone-500 mb-1.5 uppercase tracking-wide">Special Traits</h5>
              <div className="space-y-1.5">
                {traits.map((trait, i) => {
                  const traitDef = TRAIT_DEFINITIONS[trait.traitId];
                  return (
                    <div key={i} className="bg-purple-900/30 border border-purple-500/20 rounded-lg px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-purple-300 text-xs font-bold">
                          {traitDef?.name || trait.traitId}
                        </span>
                        <span className="text-purple-400 text-xs">Lv.{trait.level}</span>
                      </div>
                      {traitDef?.description && (
                        <p className="text-xs text-stone-400 mt-0.5">{traitDef.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer hint */}
          <div className="px-3 py-2 bg-stone-800/50 text-center">
            <span className="text-stone-500 text-xs">Hover over units to see details</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper component for stat boxes
function StatBox({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: typeof Heart; 
  label: string; 
  value: number | string; 
  color: string;
}) {
  return (
    <div className="bg-stone-800/50 rounded-lg p-2 text-center">
      <div className={`flex items-center justify-center gap-1 ${color} mb-0.5`}>
        <Icon size={12} />
        <span className="text-xs font-bold">{label}</span>
      </div>
      <span className="text-white font-bold text-sm">{value}</span>
    </div>
  );
}

export default UnitDetailCard;

