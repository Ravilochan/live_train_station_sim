# Contributing Guide

Thanks for contributing to Live Train Station.

This guide explains how to set up the project, propose changes, and keep contributions consistent with the current architecture.

## Prerequisites

- Node.js 18+
- npm 9+

## Local Setup

```bash
npm install
npm run dev
```

Use the URL printed by Vite (typically `http://localhost:5173`).

## Development Workflow

1. Create a branch for your work.
2. Make focused changes (small, reviewable scope).
3. Verify gameplay behavior in browser.
4. Run build checks:

```bash
npm run build
```

5. Commit with clear messages describing intent.
6. Open a pull request with context and test notes.

## Project Conventions

### Code Organization

- Keep simulation logic in `src/core/GameState.ts`.
- Keep rendering logic in `src/scenes/MainScene.ts`.
- Keep DOM/UI behavior in `src/ui/UIManager.ts`.
- Use shared interfaces from `src/types/index.ts`.
- Put level content in `src/data/*.json`.

### Event-Driven Integration

- Use `globalEvents` (`src/core/EventEmitter.ts`) for cross-module communication.
- Prefer emitting/listening to named events over direct module coupling.
- If adding a new event, define it in `EVENTS` and document payload shape.

### Type Safety

- Prefer explicit types for function params/returns.
- Avoid `any` unless unavoidable and temporary.
- Reuse existing domain types before adding new ones.

## Gameplay Change Checklist

When you touch train/platform logic:

- Validate train lifecycle transitions still complete.
- Confirm platform compatibility checks still prevent invalid assignments.
- Verify scoring/reputation behavior for both on-time and delayed departures.
- Confirm win/loss conditions still trigger correctly.
- Check queue/details UI reflects updated states.

## Level Data Contribution Checklist

When adding or editing `src/data/*.json`:

- Ensure `id` values are unique (trains and platforms).
- Ensure `platformCompatibility` uses valid values (`short`, `medium`, `long`).
- Validate event windows (`startMinute <= endMinute` and within shift duration).
- Verify win/lose condition values are achievable and balanced.
- Play through at least one complete shift for sanity.

## Pull Request Guidelines

PR description should include:

- What changed and why.
- Any architecture or data model impacts.
- Manual test steps performed.
- Screenshots/GIFs for visible UI changes (if applicable).

Recommended PR checklist:

- [ ] `npm run build` passes locally
- [ ] Key gameplay flow manually tested
- [ ] No unrelated refactors mixed in
- [ ] Documentation updated (`README.md`, this guide, or `ARCHITECTURE.md`) when needed

## Reporting Issues

Include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser + OS
- Console errors (if any)

## Scope for First Contributions

Good starter tasks:

- UI clarity improvements (labels, panel readability)
- New level JSON balancing
- Additional tutorial/help copy
- Non-breaking audio/UI polish

For larger architecture changes, please describe the approach in an issue/PR summary before implementation.
