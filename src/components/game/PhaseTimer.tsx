import { motion } from 'motion/react';
import { Swords, Settings, CheckCircle } from 'lucide-react';
import { GamePhase } from '../../types';

interface PhaseTimerProps {
  phase: GamePhase;
  turnNumber: number;
  isReady: boolean;
  onReady: () => void;
}

const phaseConfig = {
  preparation: {
    icon: Settings,
    label: 'Preparation',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500',
  },
  battle: {
    icon: Swords,
    label: 'Battle',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500',
  },
  settlement: {
    icon: CheckCircle,
    label: 'Settlement',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500',
  },
};

export function PhaseTimer({ phase, turnNumber, isReady, onReady }: PhaseTimerProps) {
  const config = phaseConfig[phase];
  const Icon = config.icon;

  return (
    <div className={`
      flex items-center gap-4 px-6 py-3 rounded-xl border-2
      ${config.bgColor} ${config.borderColor}
      transition-all duration-300
    `}>
      {/* Phase Icon */}
      <div className={`p-2 rounded-lg ${config.bgColor}`}>
        <Icon size={24} className={config.color} />
      </div>

      {/* Phase Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-bold ${config.color}`}>
            {config.label}
          </span>
          <span className="text-stone-400 text-sm">
            Turn {turnNumber}
          </span>
        </div>
      </div>

      {/* Ready Button (only in preparation) */}
      {phase === 'preparation' && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReady}
          className={`
            px-6 py-2 rounded-lg font-bold transition-all duration-200
            ${isReady 
              ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
              : 'bg-stone-700 text-stone-200 hover:bg-stone-600'
            }
          `}
        >
          {isReady ? (
            <span className="flex items-center gap-2">
              <CheckCircle size={16} />
              Ready
            </span>
          ) : (
            'Ready'
          )}
        </motion.button>
      )}
    </div>
  );
}

export default PhaseTimer;
