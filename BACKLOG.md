# BACKLOG.md — Small, testable tasks (MVP-first)

## Rules
- Each task should take ~0.5–2 hours.
- Each task must have explicit acceptance criteria.
- Prefer tests for pure logic.

---

## MVP Track

### BL-001: Choose repo layout + package manager
**AC**
- Decide: single repo vs monorepo (apps/web + apps/api)
- Decide: pnpm vs npm (pick one)
- Document commands in AGENTS.md

### BL-002: Scaffold web app (Vite + TS)
**AC**
- App runs locally (`dev`)
- Build works (`build`)
- Basic folder structure established

### BL-003: Add Phaser 3 + minimal scene
**AC**
- BootScene + GameScene loads
- Visible background + simple sprite on screen

### BL-004: Add Menu UI (start button)
**AC**
- Start button transitions to GameScene
- Game can restart without refresh

### BL-005: Implement MIDI connect + device select
**AC**
- “MIDI connected” indicator
- Device list shows inputs (when available)
- Fallback keyboard mode exists

### BL-006: MIDI note visualizer widget
**AC**
- Shows last note (name + octave) + velocity
- Shows rolling buffer of last N notes (timestamps)
**Tests**
- Unit test note-number → name converter (e.g., 60 → C4)

### BL-007: Spawn single-note invaders (basic wave)
**AC**
- Invaders spawn and move toward bottom
- Each invader has `requiredNote` within configured range

### BL-008: Single-note matching destroys invader
**AC**
- NoteOn matching `requiredNote` destroys an invader
- Wrong note does nothing (or penalty if you choose)
**Tests**
- Unit test matcher: given note buffer + invaders, selects correct target

### BL-009: Score + combo
**AC**
- Score increments on hit
- Combo increases on consecutive correct hits
- Combo resets on miss (define miss clearly)

### BL-010: Game over condition
**AC**
- If invader reaches bottom line: life decreases or game ends (pick one)
- Game Over screen shows final score

---

## Notation Lane (Approach A: DOM/SVG + VexFlow)

### BL-011: Add VexFlow and render a treble staff in a HUD container
**AC**
- A treble clef + 5-line staff appears as an SVG overlay
- It is crisp and stable on resize

### BL-012: Render a single target note on the staff
**AC**
- Given MIDI note number, it renders correct staff position
- Accidentals handled for sharps (basic)
**Tests**
- Unit test mapping: MIDI note → VF key string (e.g., C#4 → “c#/4”)

### BL-013: Notation lane shows next N targets (queue)
**AC**
- Lane updates when queue changes
- Does NOT re-render every frame (only on queue change)

---

## Backend + Leaderboard

### BL-014: Create API skeleton + database schema
**AC**
- Endpoint health check
- Tables: game_sessions, score_submissions

### BL-015: Start session endpoint (seed)
**AC**
- POST start returns sessionId + seed
- Seed used by client for deterministic waves

### BL-016: Submit score endpoint
**AC**
- POST submit stores score for sessionId
- Basic sanity checks (duration, score bounds)

### BL-017: Leaderboard endpoint
**AC**
- GET leaderboard returns top scores
- Sort order correct, limit + filters work
**Tests**
- Integration test: create 3 scores, leaderboard returns sorted

---

## Optional early polish

### BL-018: Settings panel (transpose + timing window)
**AC**
- Player can set transpose and timing tolerance before game start

### BL-019: Practice mode toggle
**AC**
- Slow spawn, unlimited lives, optional note names shown