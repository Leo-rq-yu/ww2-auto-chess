import React from 'react'
import { useGameStore } from '../../store/gameStore'
import { UNIT_DEFINITIONS } from '../../types/units'

export default function Bench() {
  const { benchState, removeUnitFromBench } = useGameStore()

  return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: 8 }).map((_, idx) => {
        const unit = benchState.pieces[idx]
        const def = unit ? UNIT_DEFINITIONS[unit.type] : null

        return (
          <div
            key={idx}
            className={`
              aspect-square border-2 rounded p-2
              ${unit ? 'bg-green-600 border-green-400 cursor-pointer hover:bg-green-500' : 'bg-gray-700 border-gray-600'}
            `}
            onClick={() => unit && removeUnitFromBench(unit.id)}
          >
            {unit && def && (
              <div className="text-center">
                <img
                  src={def.image}
                  alt={def.name}
                  className="w-full h-full object-contain mb-1"
                />
                <div className="text-xs text-white">
                  {unit.starLevel}★
                </div>
                <div className="text-xs text-yellow-300">
                  {unit.hp}/{unit.maxHp}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
