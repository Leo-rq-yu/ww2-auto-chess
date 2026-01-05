import React from 'react'
import { useGameStore } from '../../store/gameStore'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../../engine/board'
import { UNIT_DEFINITIONS } from '../../types/units'

export default function BoardGrid() {
  const { boardState, removeUnitFromBoard, placeUnitOnBoard, benchState } = useGameStore()
  const [selectedUnit, setSelectedUnit] = React.useState<string | null>(null)

  const handleCellClick = (x: number, y: number) => {
    const existingPiece = boardState.pieces.find(p => p.x === x && p.y === y)

    if (selectedUnit) {
      // Try to deploy selected unit
      if (!existingPiece) {
        placeUnitOnBoard(selectedUnit, x, y)
        setSelectedUnit(null)
      }
    } else if (existingPiece) {
      // Remove unit
      removeUnitFromBoard(x, y)
    }
  }

  const handleBenchUnitClick = (unitId: string) => {
    setSelectedUnit(selectedUnit === unitId ? null : unitId)
  }

  return (
    <div className="space-y-2">
      <div
        className="grid gap-1 bg-gray-800 p-2 rounded"
        style={{
          gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: BOARD_HEIGHT * BOARD_WIDTH }).map((_, idx) => {
          const x = idx % BOARD_WIDTH
          const y = Math.floor(idx / BOARD_WIDTH)
          const piece = boardState.pieces.find(p => p.x === x && p.y === y)
          const fort = boardState.fortifications.find(f => f.x === x && f.y === y)
          const def = piece ? UNIT_DEFINITIONS[piece.type] : null

          return (
            <div
              key={idx}
              onClick={() => handleCellClick(x, y)}
              className={`
                aspect-square border-2 rounded
                ${piece ? 'bg-blue-600 border-blue-400' : 'bg-gray-700 border-gray-600'}
                ${selectedUnit ? 'cursor-pointer hover:bg-blue-500' : piece ? 'cursor-pointer' : ''}
                flex items-center justify-center relative
              `}
            >
              {piece && def && (
                <div className="text-center">
                  <img
                    src={def.image}
                    alt={def.name}
                    className="w-8 h-8 mx-auto mb-1"
                  />
                  <div className="text-xs text-white">
                    {piece.starLevel}★
                  </div>
                  <div className="text-xs text-yellow-300">
                    {piece.hp}/{piece.maxHp}
                  </div>
                </div>
              )}
              {fort && (
                <div className="absolute inset-0 bg-yellow-600/50 border-2 border-yellow-400 rounded" />
              )}
            </div>
          )
        })}
      </div>

      {selectedUnit && (
        <div className="text-white text-sm text-center">
          Click an empty cell on the board to deploy unit
        </div>
      )}
    </div>
  )
}
