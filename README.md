# Live Train Station

Live Train Station is a browser-based station management simulation built with Phaser, TypeScript, and Vite. You assign incoming trains to compatible platforms in real time while the simulation updates train and platform states.

## Tech Stack

- TypeScript
- Phaser 3
- Vite

## Getting Started

### Prerequisites

- Node.js 18+ (recommended)
- npm

### Install Dependencies

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`) where you can play the simulation.

## Available Scripts

- `npm run dev` - start the Vite development server.
- `npm run build` - type-check with `tsc` and build production assets.
- `npm run preview` - preview the production build locally.

## How to Play

1. Wait for trains to appear at the top track.
2. Click a train to select it.
3. Compatible free platforms are highlighted.
4. Click a highlighted platform to assign the train.
5. Keep trains flowing to avoid congestion and complete level goals.

## Project Structure

```text
live_train_station/
├── src/
│   ├── assets/                # Static visual assets
│   ├── core/                  # Game state, events, tutorial, audio logic
│   ├── data/                  # Level JSON data
│   ├── scenes/                # Phaser scene rendering and interactions
│   ├── types/                 # Shared TypeScript types
│   ├── ui/                    # HUD and UI controls
│   └── main.ts                # Game bootstrap and startup flow
├── package.json               # Scripts and dependencies
└── tsconfig*.json / vite.config.ts
```

## Runtime Flow (High Level)

- `src/main.ts` boots Phaser and UI, loads level data, and starts the game state.
- `src/core/GameState.ts` drives simulation timing and train/platform lifecycle.
- `src/scenes/MainScene.ts` renders tracks, platforms, and train interactions.
- `src/core/EventEmitter.ts` coordinates communication between systems.
- `src/core/AudioManager.ts` provides event-driven synthesized game audio.

## Notes

- Level data is loaded from JSON (`src/data/level_01_morning_rush.json`).
- The game canvas is configured at `800x800` and uses responsive fit scaling.
