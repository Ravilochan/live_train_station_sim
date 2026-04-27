# Architecture Overview

This document describes how Live Train Station is structured, how systems communicate, and where to implement changes safely.

## High-Level Design

The project follows a modular, event-driven architecture:

- **Simulation core** manages game time and domain state.
- **Scene layer** renders train/platform visuals and scene interactions.
- **UI layer** manages DOM panels, controls, overlays, and actions.
- **Event bus** decouples systems through publish/subscribe.
- **Data layer** provides level definitions as JSON.

## Runtime Startup Flow

Startup is orchestrated in `src/main.ts`:

1. Create Phaser game config (`800x800`, auto-fit scaling).
2. Boot `MainScene`.
3. Boot `UIManager`.
4. Load initial level data into `gameState`.
5. Start simulation loop.
6. Initialize tutorial event listeners by importing `TutorialManager`.

## Core Modules

## `src/core/GameState.ts`

Primary responsibilities:

- Owns simulation clock (`gameMinute`) and time scaling (`speedMultiplier`).
- Advances simulation using `requestAnimationFrame`.
- Processes:
  - level events
  - train state transitions
  - platform maintenance windows
  - scoring and win/loss evaluation
- Persists progression (`score`, `xp`, `upgrades`) to `localStorage`.

Important transitions:

- `approaching -> waiting` at arrival time.
- `waiting -> assigned` after valid platform assignment.
- `assigned -> deboarding` when train reaches platform.
- `deboarding -> boarding -> ready` via timers and services.
- `ready -> cleared -> departed` after manual clearance.

## `src/scenes/MainScene.ts`

Primary responsibilities:

- Draws static tracks and platform visuals.
- Draws train graphics and animates movement.
- Handles click-to-assign interaction on platforms.
- Subscribes to train/platform selection and status events.

Design note:

- Scene stays mostly reactive to emitted events instead of computing simulation rules directly.

## `src/ui/UIManager.ts`

Primary responsibilities:

- Controls left queue, right details/action panel, bottom status bar.
- Handles speed controls, audio toggle, menu/upgrade interactions.
- Shows disruptions, help/manual overlay, tutorial prompts, and game-over modal.
- Dispatches user actions into `GameState` methods.

## `src/core/EventEmitter.ts`

Provides `globalEvents` and shared `EVENTS` constants.

Key events:

- `TIME_TICK`
- `TRAIN_SPAWNED`
- `TRAIN_STATUS_CHANGED`
- `TRAIN_SELECTED`
- `PLATFORM_STATUS_CHANGED`
- `SCORE_UPDATED`
- `SPEED_CHANGED`
- `DISRUPTION_ACTIVE`
- `GAME_OVER`

## `src/core/AudioManager.ts`

- Subscribes to global events and plays synthesized tones.
- Lazily initializes `AudioContext` to match browser gesture policies.
- Supports mute/unmute behavior.

## `src/core/TutorialManager.ts`

- Watches early gameplay milestones.
- Shows contextual guidance overlays.
- Pauses and resumes game speed around tutorial steps.

## Data and Types

## Type Definitions (`src/types/index.ts`)

Central domain contracts:

- `Train`, `Platform`, `LevelEvent`, `LevelData`, `Upgrades`
- train and platform status unions

Guideline:

- Keep these definitions authoritative; downstream modules should reference these types.

## Level Data (`src/data/*.json`)

Levels define:

- platform layout and initial constraints
- train schedule and requirements
- disruption timeline
- win and lose conditions

Current levels:

- `level_01_morning_rush.json`
- `level_02_night_shift.json`
- `level_03_storm.json`

## State and Persistence

Persisted keys in browser storage:

- `tsm_score`
- `tsm_xp`
- `tsm_upgrades`

Non-persisted runtime state (resets per loaded level):

- train/platform maps
- selected train
- current minute/timers
- in-shift counters (`missedDepartures`, `trainsServed`, etc.)

## Timing Model

- Simulation ticks by accumulating real-time delta.
- `realSecondsPerGameMinute` defines simulation pacing (default: 5 seconds).
- `speedMultiplier` controls pause/1x/2x operation.

This enables deterministic minute-step processing while preserving smooth rendering.

## Extension Points

Safe places to extend functionality:

- **New train/platform rules:** `GameState` processing methods.
- **New overlays/panels:** `UIManager` and `index.html`.
- **New rendering effects:** `MainScene`.
- **New event channels:** `EventEmitter` constants + emit/listen points.
- **New level content:** `src/data/*.json`.

## Boundaries and Coupling Rules

- Keep domain rules in `GameState`; avoid duplicating logic in UI/scene.
- Use events for cross-module communication.
- Keep JSON data declarative; avoid hardcoding level-specific logic in core modules.

## Testing Strategy (Current)

There is currently no automated test suite in this repository.

Minimum manual validation for logic changes:

1. Start a level and assign multiple train types.
2. Validate status transitions complete end-to-end.
3. Trigger/observe disruption periods.
4. Confirm score/reputation updates.
5. Validate game-over conditions (win and loss paths).

## Known Architectural Trade-offs

- Lightweight custom event bus keeps dependencies minimal, but payloads are not strongly typed end-to-end.
- Single `GameState` singleton simplifies coordination, but can become large as complexity grows.
- Manual DOM manipulation in `UIManager` is simple and fast to iterate, but requires careful ID synchronization with `index.html`.

## Suggested Next Improvements

- Add typed event payload mapping for stronger compile-time guarantees.
- Add unit tests for `GameState` transitions and scoring rules.
- Introduce a small validation utility for level JSON integrity checks.
