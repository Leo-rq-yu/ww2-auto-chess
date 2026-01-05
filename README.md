# ⚔️ WW2 Auto Chess

<div align="center">

![WW2 Auto Chess](https://img.shields.io/badge/WW2-Auto%20Chess-8B4513?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xOSA1aC0yVjNIMTdWNUg3VjNINVY1SDNWMjFIMjFWNUgxOU05IDE5SDVWMTBIOVYxOU0xOSAxOUgxMVYxMEgxOVYxOU0xOSA4SDVWNkgxOVY4WiIvPjwvc3ZnPg==)
[![React](https://img.shields.io/badge/React-19.2.3-61dafb?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![InsForge](https://img.shields.io/badge/Backend-InsForge-ff6b35?style=flat-square)](https://insforge.dev/)
[![Vite](https://img.shields.io/badge/Build-Vite-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)

**A real-time multiplayer auto-battler game set in World War II**

*Built for the [AI Build-Off Holiday Hackathon](https://luma.com/5yrfsg0u) — InsForge Track*

[🎮 Play Now](https://ww2-auto-chess-4efai30uv-leorqyus-projects.vercel.app/) • [📖 Game Guide](#gameplay) • [🛠️ Tech Stack](#technology-stack)

</div>

---

## 🎯 Project Overview

**WW2 Auto Chess** is a 2D web-based auto-battler game where 8 players (human or AI bots) compete by deploying WWII-era military units on a 6×6 tactical grid. The game features:

- **Real-time Multiplayer**: Up to 8 players per match with WebSocket synchronization
- **AI-Powered Opponents**: Smart bots powered by multiple AI models via InsForge AI Gateway
- **Strategic Depth**: 7 unique unit types with rock-paper-scissors counters and 5 synergy systems
- **Server-Authoritative Combat**: Fair play ensured through Edge Function battle simulation

---

## 📖 Game Guide

### Core Loop

```
┌─────────────────────────────────────────────────────────────────┐
│  1. PREPARATION       2. BATTLE           3. SETTLEMENT         │
│  ──────────────       ──────────          ────────────          │
│  • Buy units          • Auto-combat       • Gold income         │
│  • Position on        • Server-side       • Interest (max 5)    │
│    6×6 board            simulation        • Streak bonuses      │
│  • Upgrade ★          • HP damage to      • Leaderboard         │
│  • Click Ready          losers              update              │
└─────────────────────────────────────────────────────────────────┘
                    ↻ Repeat until 1 survivor
```

### Military Units

| Unit | HP | ATK | DEF | Range | Speed | Cost | Special |
|------|:--:|:---:|:---:|:-----:|:-----:|:----:|---------|
| 🪖 Infantry | 2 | 1-2 | 0 | 1 | 2 | 1 | Basic melee DPS |
| 🔧 Engineer | 2 | 0 | 0 | 1 | 2 | 1 | Provides fortifications |
| 🚗 Armored Car | 4 | 2-3 | 1 | 1 | 3 | 2 | +1 dmg vs Infantry |
| 🛡️ Tank | 6 | 3-4 | 2 | 1 | 1 | 3 | +1 dmg vs Armored Cars |
| 💥 Artillery | 3 | 3-4 | 0 | 3 | 0 | 3 | AoE damage, immobile |
| 🎯 Anti-Air | 3 | 2-3 | 0 | 3 | 1 | 2 | +2 dmg vs Aircraft |
| ✈️ Aircraft | 4 | 2-3 | 0 | 2 | 2 | 3 | Ignores fortifications |

### Synergy System

| Synergy | Requirement | Bonus |
|---------|:-----------:|-------|
| **Infantry** | 3 units | All Infantry +1 Defense |
| **Engineer** | 2 units | Fortification +1 armor, +1 duration |
| **Armor** | 2 units | Tanks & Armored Cars +1 Speed |
| **Artillery** | 2 units | All Artillery +1 Attack |
| **Air Force** | 2 units | Aircraft 25% dodge chance (non-AA) |

### Star Upgrades

Combine **3 identical units** to upgrade: 1★ → 2★ → 3★ with significant stat boosts!

---

## 🛠️ Technology Stack

### Frontend

- **React 19** + **TypeScript 5.9** — Modern component architecture
- **Zustand** + **Immer** — Immutable state management
- **Tailwind CSS 3.4** — Utility-first styling
- **Motion (Framer Motion)** — Smooth animations for combat visualization
- **React Router DOM 7** — Client-side routing
- **Vite (Rolldown)** — Lightning-fast builds

### Backend — Powered by [InsForge](https://insforge.dev/)

This project leverages **InsForge BaaS** for a complete serverless backend:

| Service | Usage |
|---------|-------|
| **PostgreSQL Database** | Player profiles, matches, boards, game state |
| **Authentication** | Email/password + OAuth (Google, GitHub) |
| **Real-time WebSockets** | Live game synchronization, player ready states |
| **Edge Functions** | Server-side battle simulation for fairness |
| **AI Gateway** | Multi-model bot AI with load balancing |

---

## 📊 InsForge Backend Architecture

### Database Schema

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│   players    │     │     matches     │     │    boards    │
├──────────────┤     ├─────────────────┤     ├──────────────┤
│ id (PK)      │◄────│ winner_id (FK)  │     │ id (PK)      │
│ user_id      │     │ match_id (PK)   │◄────│ match_id(FK) │
│ username     │     │ status          │     │ player_id(FK)│
│ rating       │     │ phase           │     │ board_state  │
│ created_at   │     │ turn_number     │     │ bench_state  │
└──────────────┘     │ max_players (8) │     │ synergies    │
       ▲             └─────────────────┘     └──────────────┘
       │                     │
       │             ┌───────┴───────┐
       │             ▼               │
       │      ┌─────────────────┐    │
       └──────│ match_players   │────┘
              ├─────────────────┤
              │ match_id (FK)   │
              │ player_id (FK)  │
              │ hp, money, level│
              │ is_ready, is_bot│
              │ win/lose_streak │
              └─────────────────┘
```

### Real-time Channels

- `match:{matchId}` — Match state changes
- `players:{matchId}` — Player updates & ready states
- `game:{matchId}` — Phase changes & battle results

### Edge Function: `run-battle`

Server-authoritative turn-by-turn combat simulation:

```javascript
// Input
{ matchId, turn, battleBoard, player1Id, player2Id }

// Output
{ updatedBoard, events[], isFinished, result }

// Features:
// ✓ A* pathfinding for unit movement
// ✓ Type matchup damage bonuses
// ✓ Turn-based execution by speed
// ✓ Death/damage event generation
```

### AI Bot Intelligence

Bots use **InsForge AI Gateway** with multiple models for diversity:

- `deepseek/deepseek-chat`
- `x-ai/grok-4.1-fast`
- `openai/gpt-5-mini`
- `anthropic/claude-3.5-haiku`
- `openai/gpt-4o`

Each bot receives game state context and responds with strategic commands:

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

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- InsForge account ([sign up](https://insforge.dev/))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ww2-auto-chess.git
cd ww2-auto-chess

# Install dependencies
npm install

# Configure environment
cp env.example .env
# Edit .env with your InsForge credentials:
# VITE_INSFORGE_URL=https://your-app.region.insforge.app
# VITE_INSFORGE_ANON_KEY=your-anon-key

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
ww2-auto-chess/
├── src/
│   ├── pages/              # Route components
│   │   ├── AuthPage.tsx    # Login/Register
│   │   ├── LobbyPage.tsx   # Room creation/join
│   │   └── GamePage.tsx    # Main game interface
│   ├── components/
│   │   ├── game/           # Game-specific components
│   │   │   ├── BoardGrid.tsx
│   │   │   ├── Bench.tsx
│   │   │   ├── Shop.tsx
│   │   │   └── PlayerList.tsx
│   │   └── ui/             # Reusable UI components
│   ├── engine/             # Core game logic
│   │   ├── battle.ts       # Combat simulation
│   │   ├── board.ts        # 6×6 grid management
│   │   ├── synergy.ts      # Synergy calculations
│   │   ├── economy.ts      # Gold/income rules
│   │   └── shop.ts         # Unit shop mechanics
│   ├── services/           # Backend communication
│   │   ├── insforge.ts     # SDK client instance
│   │   ├── matchService.ts # Match CRUD operations
│   │   ├── realtimeService.ts # WebSocket handlers
│   │   └── botService.ts   # AI bot logic
│   ├── store/
│   │   └── gameStore.ts    # Zustand global state
│   └── types/
│       ├── index.ts        # TypeScript interfaces
│       └── units.ts        # Unit/synergy definitions
├── functions/
│   └── run-battle.js       # InsForge Edge Function
└── assets/
    └── images/             # Unit artwork
```

---

## 🏆 Hackathon Submission

This project was built for the **[AI Build-Off Holiday Hackathon](https://luma.com/5yrfsg0u)** (Dec 22, 2025 – Jan 4, 2026), specifically for the **InsForge Track**.

### InsForge Integration Highlights

| Feature | Implementation |
|---------|---------------|
| **Database** | 6 tables with foreign keys, indexes, and real-time triggers |
| **Auth** | OAuth providers (Google, GitHub) configured |
| **Real-time** | WebSocket channels for live game synchronization |
| **Edge Functions** | Server-side battle simulation for anti-cheat |
| **AI Gateway** | 5 AI models for diverse bot personalities |

### What We Built in 3 Hours

✅ Full multiplayer auto-battler game loop  
✅ 7 unique unit types with stats and counters  
✅ 5 synergy systems for strategic depth  
✅ AI bots that play like humans  
✅ Real-time synchronization across players  
✅ Server-authoritative combat for fairness  
✅ Beautiful tactical UI with animations  

---

## 📜 License

MIT License — See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **[InsForge](https://insforge.dev/)** — For the amazing BaaS platform that made rapid backend development possible
- **[Future/BuilderZ](https://luma.com/5yrfsg0u)** — For organizing an inspiring hackathon
- The auto-chess genre pioneers: Dota Auto Chess, Teamfight Tactics, and Auto Chess

---

<div align="center">

**Built with ☕ and 🎮 during a hackathon marathon**

*If you enjoyed this project, give it a ⭐!*

</div>
