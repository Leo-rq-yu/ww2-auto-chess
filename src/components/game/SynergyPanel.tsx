import { motion } from 'motion/react';
import { SynergyProgress } from '../../engine/synergy';
import { Shield, Wrench, Target, Plane, Users } from 'lucide-react';

interface SynergyPanelProps {
  synergies: SynergyProgress[];
}

const traitIcons: Record<string, typeof Shield> = {
  infantry: Users,
  engineer: Wrench,
  armor: Shield,
  artillery: Target,
  air: Plane,
};

const traitColors: Record<string, { active: string; inactive: string }> = {
  infantry: { active: 'text-blue-400 bg-blue-500/20', inactive: 'text-stone-500 bg-stone-700/50' },
  engineer: {
    active: 'text-amber-400 bg-amber-500/20',
    inactive: 'text-stone-500 bg-stone-700/50',
  },
  armor: {
    active: 'text-emerald-400 bg-emerald-500/20',
    inactive: 'text-stone-500 bg-stone-700/50',
  },
  artillery: { active: 'text-red-400 bg-red-500/20', inactive: 'text-stone-500 bg-stone-700/50' },
  air: { active: 'text-purple-400 bg-purple-500/20', inactive: 'text-stone-500 bg-stone-700/50' },
};

export function SynergyPanel({ synergies }: SynergyPanelProps) {
  // Sort: active first, then by progress
  const sortedSynergies = [...synergies].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.currentCount / b.triggerCount - a.currentCount / a.triggerCount;
  });

  return (
    <div className="bg-stone-800/80 rounded-xl p-3 border-2 border-stone-700">
      <h3 className="text-amber-400 font-bold text-sm mb-2">Synergies</h3>

      <div className="space-y-2">
        {sortedSynergies.map(synergy => {
          const Icon = traitIcons[synergy.traitType] || Shield;
          const colors = traitColors[synergy.traitType] || traitColors.infantry;
          const progress = synergy.currentCount / synergy.triggerCount;

          return (
            <motion.div
              key={synergy.synergyId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`
                relative p-2 rounded-lg border transition-all duration-300
                ${
                  synergy.isActive
                    ? `${colors.active} border-current`
                    : `${colors.inactive} border-transparent`
                }
              `}
            >
              <div className="flex items-center gap-2">
                {/* Icon */}
                <div
                  className={`
                  w-7 h-7 rounded-lg flex items-center justify-center
                  ${synergy.isActive ? 'bg-current/20' : 'bg-stone-600/50'}
                `}
                >
                  <Icon size={16} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate">{synergy.name}</span>
                    <span
                      className={`
                      text-xs font-bold
                      ${synergy.isActive ? 'text-current' : 'text-stone-500'}
                    `}
                    >
                      {synergy.currentCount}/{synergy.triggerCount}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-1 h-1 bg-stone-700 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${synergy.isActive ? 'bg-current' : 'bg-stone-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progress * 100, 100)}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>

                  {/* Description (on hover or when active) */}
                  {synergy.isActive && (
                    <p className="text-[10px] mt-1 opacity-80 truncate">{synergy.description}</p>
                  )}
                </div>
              </div>

              {/* Active Glow */}
              {synergy.isActive && (
                <div className="absolute inset-0 rounded-lg bg-current/5 animate-pulse pointer-events-none" />
              )}
            </motion.div>
          );
        })}

        {synergies.length === 0 && (
          <div className="text-center text-stone-500 text-sm py-4">
            Deploy units to activate synergies
          </div>
        )}
      </div>
    </div>
  );
}

export default SynergyPanel;
