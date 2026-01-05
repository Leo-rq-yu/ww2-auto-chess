# WWII Auto Chess (Working Title) – Complete Design Specification

## Project Overview

**Goal**:
Develop a 2D web-based auto-battler game tentatively titled **"WWII Unit Auto Chess."**
Each match consists of **8 players**, each starting with **50 HP** and **5 gold**.
When the host clicks "Start Game", any remaining empty slots are automatically filled with **AI Bots**.

Players purchase and deploy military units such as infantry, engineers, armored cars, tanks, artillery, anti-air guns, and aircraft. All combat is fully automated once the battle phase begins.

---

## Core Game Loop

1. **Preparation Phase**

   * Players buy units from the shop
   * Refresh the shop (costs 2 gold)
   * Deploy, reposition, or merge units on the board
   * Click **"Ready"**
   * When all players are ready, the game proceeds to combat

2. **Battle Phase**

   * All surviving players are randomly paired
   * Battle simulation runs on an **Edge Function** (server-side)
   * Turn-by-turn combat with A* pathfinding
   * After combat, the total **attack power of surviving units** is summed
   * The opponent loses HP equal to this value

3. **Settlement Phase**

   * Grant base gold income (5 gold)
   * Grant interest (1 gold per 10 saved, max 5)
   * Grant streak bonus (2-3 gold for 3-5+ win/lose streak)
   * Grant +1 gold for winning
   * Display all 8 players' HP and reorder leaderboard by HP

4. Repeat until only **one player (or Bot)** remains

---

## Technology Stack & Foundation

* **Frontend**

  * React + TypeScript
  * Global state via **Zustand** with Immer middleware
  * Tailwind CSS for styling
  * Framer Motion for animations

* **Backend**

  * Built on **InsForge MCP**
  * Used for:

    * Database schema & tables (PostgreSQL via PostgREST)
    * Real-time subscriptions (WebSocket)
    * Edge Functions (battle simulation)
    * **AI Gateway** for bot decision-making

---

## Project Structure

Single application structure:

```
/ww2-autochess
  /src
    /pages          # Page components (GamePage, LobbyPage, AuthPage)
    /components     # Reusable UI components
      /game         # Game-specific components (BoardGrid, Shop, Bench, etc.)
      /ui           # Generic UI components (Button, Card, Modal)
    /engine         # Core game logic
      board.ts      # 6×6 board data structure
      battle.ts     # Combat simulation
      synergy.ts    # Synergy calculations
      economy.ts    # Gold income rules
      shop.ts       # Shop mechanics
      merge.ts      # Unit merging logic
    /services       # Backend communication
      insforge.ts   # InsForge SDK instance
      matchService.ts
      realtimeService.ts
      botService.ts
    /hooks          # React hooks (useGameFlow)
    /store          # Zustand store (gameStore.ts)
    /types          # TypeScript types and unit definitions
  /functions        # InsForge Edge Functions
    run-battle.js   # Server-side battle simulation
```

### `engine` Module

Core combat and simulation logic.

* **board.ts**

  * 6×6 board data structure
  * Placement and movement APIs
  * Piece position management

* **battle.ts**

  * Full combat simulation
  * Unit state machine: Idle → Move → Attack → Death
  * A* pathfinding via `javascript-astar`
  * Turn execution based on speed
  * Damage calculation with armor/attack type modifiers

* **synergy.ts**

  * Synergy definitions and activation logic
  * Counts only board pieces (not bench)

* **economy.ts**

  * Base income (5 gold)
  * Interest calculation (max 5)
  * Win/lose streak bonuses
  * Shop odds by player level

---

### Pages

* **AuthPage.tsx**

  * Login / Registration
  * Guest play option

* **LobbyPage.tsx**

  * Create / join room
  * Start game (fills remaining slots with bots)

* **GamePage.tsx**

  * Main UI
  * Board, shop, bench, player panel
  * Phase management via `useGameFlow` hook

### Components

* **BoardGrid** - Renders 6×6 grid with click-to-place
* **Bench** - Displays undeployed units (8 slots)
* **Shop** - Unit cards with purchase/refresh controls
* **PlayerList** - Shows all 8 players with HP and ready status
* **SynergyPanel** - Displays active synergies
* **PhaseTimer** - Shows current phase and ready button

### State Management

Single Zustand store (`gameStore.ts`) managing:

* User & match info
* Players array
* Board & bench state
* Shop state & card pool
* Synergies
* Battle state
* Phase & turn management

---

## Services Layer

* **insforge.ts** - InsForge SDK instance with database, auth, realtime, AI clients

* **matchService.ts**
  * Create/join match
  * Add players (human or bot)
  * Fill bots
  * Update player/board state
  * Get player boards for battle

* **realtimeService.ts**
  * Subscribe to match updates
  * Subscribe to player updates
  * Publish player ready state
  * Publish/listen for battle results
  * Phase change notifications

* **botService.ts**
  * Initialize bots with AI Gateway
  * Run bot AI decisions via system prompts
  * Parse and execute bot commands
  * Distribute load across multiple AI models

---

## Database Design (InsForge)

Core tables:

* `players(id, user_id, username, created_at, updated_at)`
* `matches(match_id, status, phase, turn_number, max_players, winner_id, created_at, updated_at)`
* `match_players(match_id, player_id, player_name, hp, money, level, is_ready, is_bot, is_alive, win_streak, lose_streak, placement, last_opponent_id)`
* `boards(match_id, player_id, board_state, bench_state, active_synergies)`

Notes:

* Unit definitions and synergies are defined in code (`types/units.ts`), not in database
* Shop state is managed client-side in memory
* `board_state` stores piece positions as JSON
* `is_bot` in `match_players` distinguishes AI players

---

## Backend Architecture

### Direct SDK Operations (Client-side)

All database operations use InsForge SDK directly:

* `insforge.database.from('table').select/insert/update/delete`
* No REST API layer needed

### Real-Time Flow

* **Channels**: `match:{matchId}`, `players:{matchId}`, `game:{matchId}`
* **Events**: `player_ready`, `phase_change`, `battle_results`, `bot_action`
* Players subscribe to match channels on game load
* Ready state synced via Realtime publish/subscribe

### Edge Function: `run-battle`

Server-side battle simulation to ensure fairness:

* Input: `matchId`, `turn`, `battleBoard`, `player1Id`, `player2Id`
* Processes **one turn** per invocation
* Output: `updatedBoard`, `events`, `isFinished`, `result`
* Client loops through turns, calling Edge Function each time
* Results published via Realtime

---

## Units & Base Stats

| Unit        | HP | Attack           | Armor | Attack Type / Range | Speed | Cost | Notes                                         |
| ----------- | -- | ---------------- | ----- | ------------------- | ----- | ---- | --------------------------------------------- |
| Infantry    | 2  | 1–2              | 0     | Melee (1 tile)      | 2     | 1    | Basic DPS                                     |
| Engineer    | 2  | 0                | 0     | No attack           | 2     | 1    | Builds fortifications; cannot affect aircraft |
| Armored Car | 4  | 2–3              | 1     | Melee               | 3     | 2    | +1 damage vs infantry; weak vs tanks          |
| Tank        | 6  | 3–4              | 2     | Melee               | 1     | 3    | +1 damage vs armored cars                     |
| Artillery   | 3  | 3–4              | 0     | AoE, range 3        | 0–1   | 3    | Cannot hit aircraft                           |
| Anti-Air    | 3  | 2–3 (4–5 vs air) | 0     | AoE, range 3        | 1     | 2    | Half damage to heavy armor                    |
| Aircraft    | 4  | 2–3              | 0     | Line sweep, range 2 | 2     | 3    | Air unit; ignores fortifications              |

Speed is integer; `0` means immobile.

---

## Synergies

* **Infantry ×3** → Infantry +1 armor
* **Engineering ×2** → Fortification armor +1, duration +1 turn
* **Armor ×2** → Armored units +1 speed
* **Artillery ×2** → Artillery +1 attack
* **Air Force ×2** → Aircraft gain 25% chance to ignore one non-AA hit

---

## Star Upgrades

* 3 identical units → upgrade star level (1★ → 2★ → 3★)
* Stats scale by unit type (typically +50-100% per star)
* Engineers improve structures, not attacks
* Artillery gains AoE radius at 3★

---

## Random Trait System

* ~50% chance per unit to spawn with a trait
* Traits stack up to star level
* Examples:

  * **Armor Piercing**: +damage vs armored units
  * **Blitz**: Chance for extra attack
  * **Heavy Cannon**: +attack, −speed
  * **Sniper**: +range
  * **Tenacity**: +HP
* Invalid trait/unit combinations are disallowed
* Excess traits are discarded by priority

---

## Economy & Match Resolution

* Starting gold: **5**
* Starting HP: **50**
* Base income per round: **5 gold**
* Interest: **1 gold per 10 saved** (max 5)
* Streak bonus: **2 gold** (3+ streak), **3 gold** (5+ streak)
* Win bonus: **+1 gold**
* Shop refresh cost: **2 gold**

* Random pairing each round
* Winner deals damage equal to total surviving attack power
* Loser HP ≤ 0 → eliminated
* Leaderboard updated every round

---

## AI Bot Design

Bots are full players powered by **InsForge AI Gateway**.

### AI Models (Load Distribution)

Bots are randomly assigned one of these models:

* `deepseek/deepseek-chat`
* `x-ai/grok-4.1-fast`
* `openai/gpt-5-mini`
* `anthropic/claude-3.5-haiku`
* `openai/gpt-4o`

### System Prompt Contents

**Static**

* Game rules summary
* Unit stats and synergies
* Economy rules

**Dynamic**

* Current turn number
* Bot's HP, gold, level
* Bot's board state (positions, unit types, stars)
* Bot's bench state
* Current shop cards
* Active synergies
* All players' HP (for strategic decisions)

### AI Command Output Format

The AI returns a JSON object with commands:

```json
{
  "commands": [
    { "action": "BUY", "shopIndex": 0 },
    { "action": "DEPLOY", "pieceId": "xxx", "x": 2, "y": 4 },
    { "action": "REFRESH" },
    { "action": "READY" }
  ]
}
```

Commands are parsed and executed by `botService.ts`, then bot publishes ready state via Realtime.

### Bot Behavior

* Bots subscribe to phase changes via Realtime
* At start of each preparation phase, bots request AI decision
* Bot executes commands and publishes ready when done
* Bots receive battle results and income like human players

---

## Additional Notes

* Treat Bots and players identically in UI and logic
* Host clicks "Start Game" to fill remaining slots with bots
* Design all systems to be extensible
* Balance values are **initial estimates**, subject to iteration
* No unit deployment cap (unlimited units on board)

---

## Final Instruction

Implement the project strictly following this specification.
Ensure clean architecture, complete rules, AI Bot participation via AI Gateway, and extensibility for future balance patches and new content.
