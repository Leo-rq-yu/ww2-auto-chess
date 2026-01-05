import { useGameStore } from '../../store/gameStore'
import { UNIT_DEFINITIONS, UnitType } from '../../types/units'
import { generateShopCards } from '../../engine/shop'
import { generateRandomTrait } from '../../engine/merge'

export default function Shop() {
  const {
    shopCards,
    setShopCards,
    currentPlayer,
    benchState,
    addUnitToBench,
    setBenchState,
  } = useGameStore()

  const handleBuy = async (index: number) => {
    if (!currentPlayer || !shopCards[index]) return

    const card = shopCards[index]
    if (currentPlayer.money < card.cost) {
      alert('Not enough gold')
      return
    }

    // Create unit
    const def = UNIT_DEFINITIONS[card.unitType as UnitType]
    const trait = generateRandomTrait(card.unitType as UnitType)

    const unit = {
      id: `unit_${Date.now()}_${Math.random()}`,
      type: card.unitType as UnitType,
      starLevel: 1,
      hp: def.baseHp,
      maxHp: def.baseHp,
      attack: [...def.baseAttack] as [number, number],
      armor: def.baseArmor,
      attackType: def.attackType,
      range: def.range,
      speed: def.speed,
      traits: trait ? [trait] : [],
    }

    // Check if can merge
    const sameUnits = benchState.pieces.filter(
      u => u.type === unit.type && u.starLevel === unit.starLevel
    )

    if (sameUnits.length >= 2) {
      // Can merge
      const { mergeUnits } = await import('../../engine/merge')
      const toMerge = [...sameUnits.slice(0, 2), unit]
      const merged = mergeUnits(toMerge)
      const remaining = benchState.pieces.filter(
        u => !toMerge.slice(0, 2).some(m => m.id === u.id)
      )
      setBenchState({
        pieces: [...remaining, merged],
      })
    } else {
      addUnitToBench(unit)
    }

    // Update gold (should update database via service)
    // TODO: Update gold in database

    // Remove purchased card
    const newCards = [...shopCards]
    newCards.splice(index, 1)
    setShopCards(newCards)
  }

  const handleRefresh = () => {
    if (!currentPlayer || currentPlayer.money < 2) {
      alert('Not enough gold (refresh costs 2 gold)')
      return
    }

    const newCards = generateShopCards(currentPlayer.level, 5)
    setShopCards(newCards)
    // TODO: Update gold in database
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-xl font-semibold">Shop</h2>
        <button
          onClick={handleRefresh}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm"
        >
          Refresh (2 gold)
        </button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {shopCards.map((card, idx) => {
          const def = UNIT_DEFINITIONS[card.unitType as UnitType]
          return (
            <div
              key={idx}
              className="bg-gray-800 border-2 border-gray-600 rounded p-2 cursor-pointer hover:border-blue-400"
              onClick={() => handleBuy(idx)}
            >
              <img
                src={def.image}
                alt={def.name}
                className="w-full aspect-square object-contain mb-2"
              />
              <div className="text-white text-xs text-center">
                <div className="font-semibold">{def.name}</div>
                <div className="text-yellow-400">{card.cost} gold</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
