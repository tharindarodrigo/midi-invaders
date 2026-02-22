# AGENTS.md — How Codex should work in this repo

This repo builds **MIDI Invaders (Web)**: a Phaser 3 + TypeScript web game where the player destroys invaders by playing notes on a MIDI keyboard. Notation is shown with a **DOM/SVG overlay** using **VexFlow**.

## Always read first
Before making changes, read:
- README.md
- PLANS.md
- BACKLOG.md

## Default workflow (Planning → Dev → Test)
For any BACKLOG task:
1) Restate the task in your own words.
2) List **acceptance criteria** (bullet list).
3) Write or update tests (when practical).
4) Implement the smallest change that makes tests pass.
5) Run the required commands (below) and report results.
6) Summarize changes and note any follow-ups.

## Definition of Done (DoD)
A task is done only when:
- ✅ Acceptance criteria satisfied
- ✅ Tests added/updated where practical
- ✅ Lint + tests pass
- ✅ No TODOs left in core logic
- ✅ README / docs updated if behavior changed

## Repo conventions
- TypeScript everywhere
- Prefer small, focused commits (one theme per PR)
- Avoid large refactors unless explicitly requested
- Keep functions small; name things clearly
- Add comments for non-obvious logic (especially music matching)

## Commands (locked)
Package manager and layout are now standardized:
- `pnpm` workspace monorepo
- `apps/web` + `apps/api` + `packages/shared`

### Common
- Install deps: `pnpm install`
- Lint all workspaces: `pnpm -r lint`
- Test all workspaces: `pnpm -r test`
- Build all workspaces: `pnpm -r build`
- Format check: `pnpm format`
- Format write: `pnpm format:write`

### If monorepo (apps/web + apps/api)
- Web dev: `pnpm -C apps/web dev`
- Web tests: `pnpm -C apps/web test`
- API dev: `pnpm -C apps/api dev`
- API tests: `pnpm -C apps/api test`

## Testing expectations
- Prefer unit tests for pure logic:
  - note name conversions
  - input buffer timing windows
  - matcher rules (single note → interval → chord)
  - seeded RNG wave generation
- Add integration tests for API endpoints:
  - start session, submit score, leaderboard ordering

## Notation implementation choice (locked)
- Use **VexFlow → SVG** rendered into the DOM
- Integrate into Phaser using a HUD overlay (DOM container / DOMElement)
- Avoid re-rendering VexFlow every frame; re-render only when targets change

## If ambiguous
Make a reasonable assumption, state it explicitly, and proceed.
If it affects architecture (folder structure, framework choice), pause and propose 2 options.
