# Live Train Station

Live Train Station is a browser-based station operations simulation built with Phaser, TypeScript, and Vite. You manage incoming trains, assign them to compatible platforms, handle disruptions, and clear departures while protecting station reputation.

## Table of Contents

- [What This Project Does](#what-this-project-does)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Run and Build Commands](#run-and-build-commands)
- [Gameplay Basics](#gameplay-basics)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Core Data Model](#core-data-model)
- [Level Configuration Guide](#level-configuration-guide)
- [Scoring and Win/Loss Rules](#scoring-and-winloss-rules)
- [Audio and UI Notes](#audio-and-ui-notes)
- [Persistence](#persistence)
- [Troubleshooting](#troubleshooting)
- [Development Workflow](#development-workflow)
- [Future Documentation Additions](#future-documentation-additions)

## Additional Documentation

- [Contributing Guide](./CONTRIBUTING.md)
- [Architecture Overview](./ARCHITECTURE.md)

## License

This project is licensed under the [MIT License](./LICENSE).

## What This Project Does

- Simulates station traffic in game-time minutes.
- Spawns trains from level JSON data with configurable schedules and service requirements.
- Validates platform compatibility and occupancy before assignment.
- Applies operational effects from weather/disruption events and upgrades.
- Tracks score, XP, and reputation across sessions.

## Tech Stack

- TypeScript
- Phaser 3
- Vite
- Native browser APIs (`localStorage`, `AudioContext`)

## Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+ (project scripts are npm-based)

### Installation

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).

## Run and Build Commands

- `npm run dev` - Start local development server with hot reload.
- `npm run build` - Type-check (`tsc`) and create production bundle in `dist/`.
- `npm run preview` - Serve the production build locally from `dist/`.

Typical release check:

```bash
npm run build && npm run preview
```

## Gameplay Basics

1. Wait for trains to arrive and enter `waiting` state.
2. Select a train from queue or scene.
3. Assign to a compatible free platform.
4. Let it cycle through `deboarding -> boarding -> ready`.
5. Clear departure before schedule penalties escalate.

Operational tips:

- High-priority trains have stronger reputation impact when delayed.
- Trains waiting too long outside station gradually reduce reputation.
- Maintenance/weather events can temporarily reduce effective capacity.

## Project Structure

```text
live_train_station/
├── src/
│   ├── assets/                    # Static assets used by UI/game
│   ├── core/
│   │   ├── AudioManager.ts        # Synthesized game audio + mute/init
│   │   ├── EventEmitter.ts        # Global event bus and event names
│   │   ├── GameState.ts           # Core simulation loop and game logic
│   │   └── TutorialManager.ts     # Event-driven tutorial overlays
│   ├── data/
│   │   ├── level_01_morning_rush.json
│   │   ├── level_02_night_shift.json
│   │   └── level_03_storm.json
│   ├── scenes/
│   │   └── MainScene.ts           # Phaser rendering and platform interactions
│   ├── types/
│   │   └── index.ts               # Shared domain types/interfaces
│   ├── ui/
│   │   └── UIManager.ts           # DOM HUD, menu, queue, actions, modals
│   ├── main.ts                    # App bootstrap (scene + UI + level load)
│   └── style.css                  # Main styling
├── index.html                     # Root app layout and overlays
├── package.json                   # Scripts and dependencies
└── README.md
```

## Architecture Overview

### Startup Sequence

`src/main.ts` performs the app bootstrap in this order:

1. Create Phaser game with `MainScene`.
2. Create `UIManager` to wire DOM interactions.
3. Load initial level data into `GameState`.
4. Start simulation loop.

### Runtime Responsibilities

- `GameState`:
  - Owns simulation clock and time progression.
  - Manages train/platform state transitions.
  - Computes score, XP, reputation, and win/loss conditions.
- `MainScene`:
  - Draws tracks, platforms, and train objects.
  - Handles click interaction for assigning platforms.
  - Reacts to state changes through events.
- `UIManager`:
  - Renders queue/details panels and controls.
  - Handles speed changes, level selection, upgrades, help/modal states.
  - Triggers gameplay actions (`assign`, `clear departure`, `purchase upgrade`).
- `EventEmitter`:
  - Decouples systems with pub/sub events.
- `AudioManager`:
  - Plays feedback tones for gameplay events.

### Event-Driven Flow

Most systems communicate through `globalEvents`:

- Time: `TIME_TICK`
- Train lifecycle: `TRAIN_SPAWNED`, `TRAIN_STATUS_CHANGED`, `TRAIN_SELECTED`
- Platform updates: `PLATFORM_STATUS_CHANGED`
- Meta/game state: `SCORE_UPDATED`, `SPEED_CHANGED`, `GAME_OVER`, `DISRUPTION_ACTIVE`

This keeps rendering (`MainScene`), UI (`UIManager`), and simulation (`GameState`) independent.

## Core Data Model

Defined in `src/types/index.ts`:

- `Train`: static config + runtime fields (`status`, `assignedPlatformId`, timers).
- `Platform`: compatibility and occupancy state + maintenance timing.
- `LevelEvent`: timed events (maintenance/weather).
- `LevelData`: full level package (platforms, trains, events, conditions).
- `Upgrades`: permanent progression modifiers affecting operations.

Train status lifecycle generally follows:

`approaching -> waiting -> assigned -> deboarding -> boarding -> ready -> cleared -> departed`

## Level Configuration Guide

Levels live under `src/data/*.json`.

Each level should provide:

- Metadata: `id`, `name`, `description`, `durationMinutes`
- `platforms`: IDs, lengths, initial status, and maintenance blocks
- `trains`: schedule, compatibility, timing, service requirements, priority
- `events`: disruption windows (weather or maintenance)
- `winConditions` and `loseConditions`

To add a new level:

1. Add a new JSON file in `src/data/`.
2. Ensure all train/platform IDs are unique within that file.
3. Import and expose it through the startup/menu flow (if not already auto-loaded).
4. Validate by running `npm run dev` and completing one shift cycle.

## Scoring and Win/Loss Rules

From `GameState` behavior:

- Positive outcomes:
  - Clearing trains grants score + XP.
  - On-time departures grant bonus score + XP.
- Negative outcomes:
  - Delays reduce score and reputation.
  - Long waiting time outside the station slowly decreases reputation.
  - Missed departures are counted and can trigger failure.

Game ends when:

- Reputation falls below level minimum (loss), or
- Missed departures exceed allowed maximum (loss), or
- Shift duration completes and win targets are evaluated (win/loss).

## Audio and UI Notes

- Audio is initialized lazily and may require user interaction to resume browser audio context.
- Manual/help and tutorial overlays are defined in `index.html`.
- UI controls map to game actions through `UIManager`.

## Persistence

Stored in `localStorage` by `GameState`:

- `tsm_xp`
- `tsm_upgrades`
- `tsm_score`

Useful during development:

- To reset progression, clear browser local storage for the app origin.

## Troubleshooting

- App loads but no gameplay updates:
  - Confirm speed is not paused (`Pause` button active means speed `0`).
- Audio not playing:
  - Interact with page once, then toggle mute/unmute again.
- Build errors:
  - Run `npm install` again and retry `npm run build`.
- UI elements missing:
  - Check that `index.html` IDs match those used in `UIManager.ts`.

## Development Workflow

Recommended day-to-day flow:

1. `npm install`
2. `npm run dev`
3. Make changes in `src/`
4. Validate behavior in browser
5. Run `npm run build` before commit

When modifying core logic:

- Keep state transitions in `GameState` single-sourced.
- Use `globalEvents` for cross-module communication.
- Keep scene rendering reactive to events rather than direct coupling.

## Future Documentation Additions

If this project grows, consider adding:

- `CONTRIBUTING.md` for PR standards and testing checklist
- `ARCHITECTURE.md` for deeper design decisions and diagrams
- `CHANGELOG.md` for release notes
- Gameplay balancing guide (timers, penalties, upgrade effects)
