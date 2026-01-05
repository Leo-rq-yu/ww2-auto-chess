import { insforge } from './insforge'
import { Unit } from '../types/units'
import { Player, BoardState, ShopCard } from '../types/game'

const AI_MODELS = [
  'deepseek/deepseek-r1',
  'x-ai/grok-4.1-fast',
  'anthropic/claude-3.5-haiku',
  'openai/gpt-4o',
]

interface BotAction {
  type: 'BUY' | 'DEPLOY' | 'REFRESH_SHOP' | 'READY' | 'LEVEL_UP'
  cardIndex?: number
  pieceId?: string
  position?: { x: number; y: number }
}

interface BotResponse {
  reasoning?: string
  actions: BotAction[]
}

function buildSystemPrompt(
  turnNumber: number,
  bot: Player,
  boardState: BoardState,
  benchState: { pieces: Unit[] },
  shopCards: ShopCard[],
  synergies: any[],
  allPlayers: Player[]
): string {
  const basePrompt = `You are an AI player in a WW2 Auto-Chess game. Make optimal decisions based on the current game state.

## Game Rules
- During preparation phase: buy units, deploy units to board, upgrade experience
- Gold is used to buy units (1-5 cost) and refresh shop (2 gold)
- Board is 6x6, you can only deploy on the bottom half (y=3-5)
- 3 identical units merge into a higher star level

## Unit Types
- Infantry (1 cost): Basic melee unit, high HP
- Engineer (1 cost): Can build fortifications, provides defense
- Armored Car (2 cost): Fast movement, good for flanking
- Tank (3 cost): Heavy armor, high attack
- Artillery (3 cost): Ranged attack, area damage
- Anti-Air (4 cost): Anti-aircraft specialty
- Aircraft (5 cost): High mobility, can cross terrain

## Synergy Effects
- Infantry synergy (3): All units +10% attack
- Engineer synergy (2): Fortifications +1 armor
- Armor synergy (2): All units +15% armor
- Artillery synergy (2): Skill damage +20%
- Air Force synergy (2): Evasion +10%

## Decision Principles
1. Prioritize units that complete synergies
2. Maintain healthy economy
3. Adapt to opponent compositions
4. Deploy wisely: tanks front, damage dealers back

## Output Format
Return JSON with a series of actions:
{
  "reasoning": "Brief explanation of decision",
  "actions": [
    { "type": "BUY", "cardIndex": 0 },
    { "type": "DEPLOY", "pieceId": "xxx", "position": { "x": 2, "y": 4 } },
    { "type": "REFRESH_SHOP" },
    { "type": "LEVEL_UP" },
    { "type": "READY" }
  ]
}

Notes:
- cardIndex is shop card index (0-4)
- position.x range 0-5, position.y range 3-5 (your half)
- Last action should be READY
- Don't buy if insufficient gold

## Current Game State

Turn: ${turnNumber}

Your Status:
- HP: ${bot.hp}/50
- Gold: ${bot.money}
- Level: ${bot.level}
- Win Streak: ${bot.winStreak}
- Lose Streak: ${bot.loseStreak}

Your Board Units:
${boardState.pieces.length > 0 
  ? boardState.pieces.map(p => `- ${p.type} (${p.starLevel}★) HP:${p.hp}/${p.maxHp} Position:(${p.x},${p.y})`).join('\n')
  : 'None'}

Your Bench Units:
${benchState.pieces.length > 0
  ? benchState.pieces.map(p => `- ${p.type} (${p.starLevel}★) HP:${p.hp}/${p.maxHp} ID:${p.id}`).join('\n')
  : 'None'}

Current Shop (refresh costs 2 gold):
${shopCards.map((c, i) => `[${i}] ${c.unitType} - ${c.cost} gold`).join('\n')}

Active Synergies:
${synergies.length > 0
  ? synergies.map(s => `- ${s.type} (level ${s.level})`).join('\n')
  : 'None'}

All Players HP Ranking:
${allPlayers.map((p, i) => `${i + 1}. ${p.playerName}: ${p.hp} HP`).join('\n')}`

  return basePrompt
}

interface BotCommand {
  action: 'BUY' | 'DEPLOY' | 'REFRESH' | 'READY' | 'MERGE'
  shopIndex?: number
  pieceId?: string
  x?: number
  y?: number
  mergeIds?: string[]
}

export async function getBotDecision(
  bot: Player,
  _matchId: string,
  turnNumber: number,
  boardState: BoardState,
  benchState: { pieces: Unit[] },
  shopCards: ShopCard[],
  synergies: any[],
  allPlayers: Player[]
): Promise<BotCommand[]> {
  // Randomly select an AI model
  const model = AI_MODELS[Math.floor(Math.random() * AI_MODELS.length)]

  const systemPrompt = buildSystemPrompt(
    turnNumber,
    bot,
    boardState,
    benchState,
    shopCards,
    synergies,
    allPlayers
  )

  try {
    const completion = await insforge.ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: 'Make your decision based on the current game state. Return JSON format with actions.',
        },
      ],
      temperature: 0.7,
      maxTokens: 1000,
    })

    const content = completion.choices[0]?.message?.content || '{}'
    
    // Try to parse JSON (may contain markdown code blocks)
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    const response: BotResponse = JSON.parse(jsonStr)
    
    // Convert actions to commands format for compatibility
    const commands = response.actions.map(action => {
      if (action.type === 'BUY') {
        return { action: 'BUY' as const, shopIndex: action.cardIndex }
      } else if (action.type === 'DEPLOY') {
        return {
          action: 'DEPLOY' as const,
          pieceId: action.pieceId,
          x: action.position?.x,
          y: action.position?.y,
        }
      } else if (action.type === 'REFRESH_SHOP') {
        return { action: 'REFRESH' as const }
      } else if (action.type === 'READY') {
        return { action: 'READY' as const }
      }
      return { action: 'READY' as const }
    })

    return commands.length > 0 ? commands : [{ action: 'READY' }]
  } catch (error) {
    console.error('Bot AI decision error:', error)
    // Default behavior: buy first card if enough gold, otherwise ready
    if (bot.money >= shopCards[0]?.cost) {
      return [{ action: 'BUY' as const, shopIndex: 0 }, { action: 'READY' as const }]
    }
    return [{ action: 'READY' as const }]
  }
}
