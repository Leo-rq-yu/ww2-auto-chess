import insforge from './insforge';
import { realtimeService } from './realtimeService';
import { updateBoardState } from './matchService';
import { Player, Piece, BoardState, ShopCard, UnitTypeId } from '../types';
import { UNIT_DEFINITIONS } from '../types/units';
import { v4 as uuidv4 } from 'uuid';

// =============================================
// Bot Service - AI-Powered Bot Players
// Uses InsForge AI Gateway + Realtime
// =============================================

// Available AI models for bots - distributed across providers to reduce load
// Models configured in InsForge AI Gateway
const AI_MODELS = [
  'x-ai/grok-4.1-fast', // Grok 4.1 Fast
  'openai/gpt-5-mini', // GPT-4o Mini
  'anthropic/claude-3.5-haiku', // Claude 3.5 Haiku
  'openai/gpt-4o', // GPT-4o
];

// Track which model each bot uses
const botModels = new Map<string, string>();

// Assign a random model to a bot
function assignModelToBot(botId: string): string {
  const model = AI_MODELS[Math.floor(Math.random() * AI_MODELS.length)];
  botModels.set(botId, model);
  console.log(`[Bot ${botId}] Assigned AI model: ${model}`);
  return model;
}

// Get model for a bot (or assign one if not exists)
function getModelForBot(botId: string): string {
  let model = botModels.get(botId);
  if (!model) {
    model = assignModelToBot(botId);
  }
  return model;
}

// Bot System Prompt for AI decision making
const BOT_SYSTEM_PROMPT = `You are an AI player in a WW2 Auto-Chess game. Make optimal decisions based on the current game state.

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
- Anti-Air (2 cost): Anti-aircraft specialty
- Aircraft (3 cost): High mobility, can cross terrain

## Synergy Effects
- Infantry synergy (3): All units +10% attack
- Engineer synergy (2): Fortifications +1 armor
- Armor synergy (2): All units +15% armor
- Artillery synergy (2): Skill damage +20%
- Air Force synergy (2): Evasion +10%

## Decision Principles
1. **CRITICAL RULE: If you have NO units on the board (currentBoardCount = 0), you MUST buy at least one unit AND deploy it! Having zero units means automatic loss!**
2. Always try to have at least 1-2 units on the board
3. Prioritize units that complete synergies
4. Maintain healthy economy (but NOT at the cost of having zero units!)
5. Adapt to opponent compositions
6. Deploy wisely: tanks front, damage dealers back

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
- **IMPORTANT: If currentBoardCount is 0, your actions MUST include at least one BUY followed by a DEPLOY!**
- After BUY, use the piece id from benchUnits to DEPLOY
- Don't buy if insufficient gold`;

// Bot state stored in memory (not database)
interface BotMemoryState {
  playerId: string;
  playerName: string;
  hp: number;
  money: number;
  level: number;
  bench: Piece[];
  board: BoardState;
  isAlive: boolean;
}

// Store bot states in memory
const botMemoryStates = new Map<string, Map<string, BotMemoryState>>();

// Initialize a bot for a match
export function initializeBot(matchId: string, botPlayer: Player): void {
  if (!botMemoryStates.has(matchId)) {
    botMemoryStates.set(matchId, new Map());
  }

  const state: BotMemoryState = {
    playerId: botPlayer.id,
    playerName: botPlayer.name,
    hp: botPlayer.hp,
    money: botPlayer.money,
    level: botPlayer.level,
    bench: [],
    board: { pieces: {}, piecePositions: {}, size: { width: 6, height: 6 } },
    isAlive: true,
  };

  botMemoryStates.get(matchId)!.set(botPlayer.id, state);

  // Assign a random AI model to this bot
  const assignedModel = assignModelToBot(botPlayer.id);
  console.log(
    `[Bot] Initialized bot ${botPlayer.name} for match ${matchId} with model: ${assignedModel}`
  );
}

// Get bot state from memory
export function getBotMemoryState(matchId: string, botId: string): BotMemoryState | undefined {
  return botMemoryStates.get(matchId)?.get(botId);
}

// Subscribe bot to match events via Realtime
export async function subscribeBotToMatch(matchId: string, botId: string): Promise<void> {
  // Subscribe to preparation phase start
  realtimeService.onPhaseChange(matchId, async (phase, turnNumber) => {
    if (phase === 'preparation') {
      console.log(`[Bot ${botId}] Preparation phase started, turn ${turnNumber}`);
      // Small delay to simulate thinking
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      await runBotAIDecision(matchId, botId);
    }
  });

  console.log(`[Bot ${botId}] Subscribed to match ${matchId}`);
}

// Run AI decision for a bot
export async function runBotAIDecision(matchId: string, botId: string): Promise<void> {
  const botState = getBotMemoryState(matchId, botId);
  if (!botState || !botState.isAlive) {
    console.log(`[Bot ${botId}] Bot is dead or not found, skipping`);
    return;
  }

  try {
    // Build game state context for AI
    const gameContext = buildGameContext(matchId, botId);

    // Get the model assigned to this bot
    const model = getModelForBot(botId);
    console.log(`[Bot ${botState.playerName}] Calling AI (${model}) for decision...`);

    // Call InsForge AI Gateway with the bot's assigned model
    const completion = await insforge.ai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: BOT_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(gameContext, null, 2) },
      ],
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      console.error(`[Bot ${botState.playerName}] AI returned empty response`);
      await publishBotReady(matchId, botId);
      return;
    }

    console.log(`[Bot ${botState.playerName}] AI response:`, aiResponse);

    // Parse AI decision
    const decision = parseAIDecision(aiResponse);
    console.log(`[Bot ${botState.playerName}] Decision: ${decision.reasoning}`);

    // Execute actions via Realtime
    for (const action of decision.actions) {
      await executeActionViaRealtime(matchId, botId, action);
      // Small delay between actions
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
    }
  } catch (error) {
    console.error(`[Bot ${botState.playerName}] AI decision error:`, error);
    // Fallback: just mark as ready
    await publishBotReady(matchId, botId);
  }
}

// Build game context for AI
function buildGameContext(matchId: string, botId: string): object {
  const botState = getBotMemoryState(matchId, botId);
  if (!botState) return {};

  // Get or create bot's shop
  let matchShops = botShops.get(matchId);
  if (!matchShops) {
    matchShops = new Map();
    botShops.set(matchId, matchShops);
  }

  let shop = matchShops.get(botId);
  if (!shop) {
    shop = generateShopForBot(botState.level);
    matchShops.set(botId, shop);
  }

  // Get all bots in match for opponent info
  const allBots = botMemoryStates.get(matchId);
  const opponents = allBots
    ? Array.from(allBots.values())
        .filter(b => b.playerId !== botId && b.isAlive)
        .map(b => ({ name: b.playerName, hp: b.hp, level: b.level }))
    : [];

  return {
    myState: {
      name: botState.playerName,
      hp: botState.hp,
      money: botState.money,
      level: botState.level,
      benchUnits: botState.bench.map(p => ({
        id: p.id,
        type: p.typeId,
        level: p.level,
      })),
      boardUnits: Object.values(botState.board.pieces).map(p => ({
        id: p.id,
        type: p.typeId,
        level: p.level,
        position: p.position,
      })),
      unitCap: getUnitCapForLevel(),
      currentBoardCount: Object.keys(botState.board.pieces).length,
    },
    shop: shop.map((card, index) => ({
      index,
      typeId: card.typeId,
      cost: card.cost,
      purchased: card.purchased,
    })),
    opponents,
    unitInfo: Object.fromEntries(
      Object.entries(UNIT_DEFINITIONS).map(([id, def]) => [
        id,
        { name: def.name, cost: def.cost, traits: def.traits || [] },
      ])
    ),
  };
}

// Generate shop cards for bot (simplified, uses level for future weighted distribution)
function generateShopForBot(level: number): ShopCard[] {
  const unitTypes = Object.keys(UNIT_DEFINITIONS) as UnitTypeId[];
  const cards: ShopCard[] = [];

  // Use level to bias towards appropriate cost units (higher level = more expensive units available)
  const maxCostForLevel = Math.min(3, Math.ceil(level / 3));

  for (let i = 0; i < 5; i++) {
    // Filter units by cost based on level
    const availableUnits = unitTypes.filter(typeId => {
      const def = UNIT_DEFINITIONS[typeId];
      return def && def.cost <= maxCostForLevel;
    });
    const pool = availableUnits.length > 0 ? availableUnits : unitTypes;
    const typeId = pool[Math.floor(Math.random() * pool.length)];
    const def = UNIT_DEFINITIONS[typeId];
    cards.push({
      index: i,
      typeId,
      cost: def?.cost || 1,
      traits: [],
      purchased: false,
    });
  }

  return cards;
}

// Get unit cap for level - no limit (matches economy.ts)
function getUnitCapForLevel(): number {
  return 99; // No limit
}

// Parse AI decision from response
function parseAIDecision(response: string): { reasoning: string; actions: BotAction[] } {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        reasoning: parsed.reasoning || 'AI decision',
        actions: parsed.actions || [{ type: 'READY' }],
      };
    }
  } catch (e) {
    console.error('[Bot] Failed to parse AI response:', e);
  }

  // Fallback
  return {
    reasoning: 'Fallback - could not parse AI response',
    actions: [{ type: 'READY' }],
  };
}

// Bot action types
interface BotAction {
  type: 'BUY' | 'DEPLOY' | 'REFRESH_SHOP' | 'LEVEL_UP' | 'READY';
  cardIndex?: number;
  pieceId?: string;
  position?: { x: number; y: number };
}

// Execute action via Realtime
async function executeActionViaRealtime(
  matchId: string,
  botId: string,
  action: BotAction
): Promise<void> {
  const channel = `match:${matchId}`;

  switch (action.type) {
    case 'BUY':
      await insforge.realtime.publish(channel, 'bot_action', {
        botId,
        actionType: 'BUY',
        cardIndex: action.cardIndex,
      });
      // Update local state
      updateBotAfterBuy(matchId, botId, action.cardIndex!);
      break;

    case 'DEPLOY':
      await insforge.realtime.publish(channel, 'bot_action', {
        botId,
        actionType: 'DEPLOY',
        pieceId: action.pieceId,
        position: action.position,
      });
      // Update local state
      updateBotAfterDeploy(matchId, botId, action.pieceId!, action.position!);
      break;

    case 'REFRESH_SHOP':
      await insforge.realtime.publish(channel, 'bot_action', {
        botId,
        actionType: 'REFRESH_SHOP',
      });
      updateBotAfterRefresh(matchId, botId);
      break;

    case 'LEVEL_UP':
      await insforge.realtime.publish(channel, 'bot_action', {
        botId,
        actionType: 'LEVEL_UP',
      });
      updateBotAfterLevelUp(matchId, botId);
      break;

    case 'READY':
      await publishBotReady(matchId, botId);
      break;
  }
}

// Publish bot ready status and save board state to database
async function publishBotReady(matchId: string, botId: string): Promise<void> {
  const state = getBotMemoryState(matchId, botId);

  // Save bot's board state to database so Edge Function can access it
  if (state) {
    try {
      await updateBoardState(
        matchId,
        botId,
        state.board as unknown as Parameters<typeof updateBoardState>[2],
        state.bench as unknown as Parameters<typeof updateBoardState>[3]
      );
      console.log(
        `[Bot ${botId}] Saved board state to database (${Object.keys(state.board.pieces).length} pieces)`
      );
    } catch (err) {
      console.error(`[Bot ${botId}] Failed to save board state:`, err);
    }
  }

  await insforge.realtime.publish(`match:${matchId}`, 'player_ready', {
    match_id: matchId,
    player_id: botId,
    is_ready: true,
    is_bot: true,
  });
  console.log(`[Bot ${botId}] Published ready status`);
}

// Bot's simulated shop state
const botShops = new Map<string, Map<string, ShopCard[]>>();

// Update bot state after buying - creates actual pieces
function updateBotAfterBuy(matchId: string, botId: string, cardIndex: number): void {
  const state = getBotMemoryState(matchId, botId);
  if (!state) return;

  // Get bot's shop
  let matchShops = botShops.get(matchId);
  if (!matchShops) {
    matchShops = new Map();
    botShops.set(matchId, matchShops);
  }

  let shop = matchShops.get(botId);
  if (!shop) {
    shop = generateShopForBot(state.level);
    matchShops.set(botId, shop);
  }

  const card = shop[cardIndex];
  if (!card || card.purchased || state.money < card.cost) {
    console.log(
      `[Bot ${botId}] Cannot buy card ${cardIndex} - purchased: ${card?.purchased}, money: ${state.money}, cost: ${card?.cost}`
    );
    return;
  }

  // Deduct money
  state.money -= card.cost;
  card.purchased = true;

  // Create piece from card
  const def = UNIT_DEFINITIONS[card.typeId];
  if (!def) return;

  // Get matchId from state (bots track this via memory)
  const matchShopsEntries = Array.from(botShops.entries());
  const currentMatchId = matchShopsEntries.find(([, shops]) => shops.has(botId))?.[0] || '';

  const piece: Piece = {
    id: uuidv4(),
    typeId: card.typeId,
    ownerId: botId,
    matchId: currentMatchId,
    level: 1,
    position: null,
    benchSlot: state.bench.length,
    isOnBoard: false,
    currentHp: def.baseHp,
    maxHp: def.baseHp,
    attack: def.baseAttackMin, // Use min attack as base
    attackMin: def.baseAttackMin,
    attackMax: def.baseAttackMax,
    defense: def.baseDefense,
    speed: def.baseSpeed,
    range: def.baseRange,
    status: 'idle',
    facingUp: true,
    traits: [],
  };

  state.bench.push(piece);
  console.log(`[Bot ${botId}] Bought ${card.typeId}, bench size: ${state.bench.length}`);
}

// Update bot state after deploying
function updateBotAfterDeploy(
  matchId: string,
  botId: string,
  pieceId: string,
  position: { x: number; y: number }
): void {
  const state = getBotMemoryState(matchId, botId);
  if (!state) return;

  // Move piece from bench to board
  const pieceIndex = state.bench.findIndex(p => p.id === pieceId);
  if (pieceIndex >= 0) {
    const piece = state.bench.splice(pieceIndex, 1)[0];
    piece.position = position;
    piece.isOnBoard = true;
    state.board.pieces[piece.id] = piece;
    state.board.piecePositions[`${position.x},${position.y}`] = piece.id;
  }
}

// Update bot state after refresh
function updateBotAfterRefresh(matchId: string, botId: string): void {
  const state = getBotMemoryState(matchId, botId);
  if (!state || state.money < 2) return;

  state.money -= 2;

  // Generate new shop
  const matchShops = botShops.get(matchId);
  if (matchShops) {
    matchShops.set(botId, generateShopForBot(state.level));
    console.log(`[Bot ${botId}] Refreshed shop`);
  }
}

// Update bot state after level up
function updateBotAfterLevelUp(matchId: string, botId: string): void {
  const state = getBotMemoryState(matchId, botId);
  if (!state) return;
  const cost = state.level * 4;
  if (state.money >= cost) {
    state.money -= cost;
    state.level = Math.min(10, state.level + 1);
  }
}

// Apply battle result to bot
export function applyBattleResultToBot(
  matchId: string,
  botId: string,
  damage: number,
  won: boolean,
  income: number
): void {
  const state = getBotMemoryState(matchId, botId);
  if (!state) return;

  if (!won) {
    state.hp = Math.max(0, state.hp - damage);
    state.isAlive = state.hp > 0;
  }
  state.money += income;

  console.log(
    `[Bot ${state.playerName}] Battle result: ${won ? 'WIN' : 'LOSE'}, HP: ${state.hp}, Money: ${state.money}`
  );
}

// Cleanup bots for a match
export function cleanupBots(matchId: string): void {
  // Clean up model assignments for bots in this match
  const botsInMatch = botMemoryStates.get(matchId);
  if (botsInMatch) {
    for (const botId of botsInMatch.keys()) {
      botModels.delete(botId);
    }
  }

  botMemoryStates.delete(matchId);
  botShops.delete(matchId);
  console.log(`[Bot] Cleaned up bots for match ${matchId}`);
}

// Get all bot IDs in a match
export function getBotIds(matchId: string): string[] {
  const bots = botMemoryStates.get(matchId);
  return bots ? Array.from(bots.keys()) : [];
}

// Initialize all bots for a match and subscribe them
export async function initializeAndSubscribeBots(
  matchId: string,
  botPlayers: Player[]
): Promise<void> {
  for (const bot of botPlayers) {
    initializeBot(matchId, bot);
    await subscribeBotToMatch(matchId, bot.id);

    // Bots will make AI decision and then become ready
    // Trigger initial decision for first round
    console.log(`[Bot ${bot.id}] Starting initial AI decision for turn 0`);
    // Small delay before first decision
    setTimeout(
      () => {
        runBotAIDecision(matchId, bot.id);
      },
      2000 + Math.random() * 3000
    );
  }
  console.log(
    `[Bot] Initialized ${botPlayers.length} bots for match ${matchId} (will decide via AI)`
  );
}

// Get the AI model assigned to a specific bot
export function getBotModel(botId: string): string | undefined {
  return botModels.get(botId);
}

// Get all available AI models
export function getAvailableModels(): string[] {
  return [...AI_MODELS];
}

export default {
  initializeBot,
  getBotMemoryState,
  subscribeBotToMatch,
  runBotAIDecision,
  applyBattleResultToBot,
  cleanupBots,
  getBotIds,
  initializeAndSubscribeBots,
  getBotModel,
  getAvailableModels,
};
