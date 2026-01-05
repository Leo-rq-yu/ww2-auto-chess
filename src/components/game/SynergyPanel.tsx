import React from 'react'
import { useGameStore } from '../../store/gameStore'
import { SYNERGIES } from '../../types/units'

export default function SynergyPanel() {
  const { synergies } = useGameStore()

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
      <h2 className="text-white text-xl font-semibold mb-4">Synergies</h2>
      {synergies.length === 0 ? (
        <div className="text-gray-400 text-sm">No active synergies</div>
      ) : (
        <div className="space-y-2">
          {synergies.map((synergy) => {
            const def = SYNERGIES[synergy.type]
            return (
              <div
                key={synergy.type}
                className="bg-blue-700/50 p-2 rounded text-white text-sm"
              >
                <div className="font-semibold">{def.name} (Level {synergy.level})</div>
                <div className="text-gray-300 text-xs">
                  {def.effects.join(', ')}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
