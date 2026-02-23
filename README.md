# MIDI Invaders (Web) — Detailed Requirements + Step-by-step Build Plan

## Quickstart (Current Scaffold)

### Monorepo layout
- `apps/web` — React + Phaser + TypeScript client
- `apps/api` — Fastify + TypeScript + Prisma API
- `packages/shared` — shared contracts/types

### Local setup
1. `pnpm install`
2. Create database: `createdb midi_invaders` (or `/opt/homebrew/opt/libpq/bin/createdb midi_invaders` if `createdb` is not on `PATH`)
3. `cp apps/api/.env.example apps/api/.env` and set `DATABASE_URL`
4. `pnpm -C apps/api exec prisma migrate dev --name init`
5. `pnpm -C apps/web dev` (web client on Vite)
6. `pnpm -C apps/api dev` (API on `http://localhost:3001`)

### MIDI hardware test (DGX-670)
1. Connect Yamaha DGX-670 to your machine over USB.
2. Open the web client in a Chromium browser.
3. In the HUD panel click `Connect MIDI`.
4. Select the DGX-670 input from the device dropdown.
5. Use the large `Play` button shown over the game canvas to start.
6. Press notes and verify they appear in `Recent Notes`.

### UX notes
- The game canvas now shows a keyboard SVG and quick instructions before gameplay starts.
- The selected MIDI input is stored and automatically reselected after reload when that device is still connected.
- Successful hits now show a floating `+points` popup near the destroyed invader.
- Difficulty level 1 now starts with one incoming invader and ramps up by wave.
- Difficulty level 2 now trains bass-clef reading with targets from `C2` to `C4`, including an `A3`-to-`C4` treble/bass overlap for ledger-line practice, while keeping notation within about two ledger lines per clef.
- Gameplay options now support `Arcade` (preset difficulty) and `Practice` mode with custom clef selection, speed control, and lives mode (`default` vs `infinite`).
- In `Practice` mode with `infinite` lives, the `1UP` meter and 1000-point pulse power-up are disabled.
- Wrong notes now apply a `-50` score penalty, show a floating penalty popup, and freeze gameplay for 1 second.
- In `Computer Keyboard` mode, turning `CapsLock` on shifts mapped notes down by two octaves for bass-note practice.
- A separate `1UP` meter grants `+1 life` every 1000 points of meter progress; penalties reduce this meter down to `0` minimum without removing earned lives.
- On each life-up power-up, a green pulse erupts from center and clears up to the 5 nearest invaders.
- Treble staff stems now point downward for notes above the center line.
- Invaders now use a circular shell style instead of rigid square frames.
- Staff notation is vertically centered inside circular invaders for clearer alignment.
- Laser shots now fire as directional red blaster bursts that impact the target, then fade in glow strength.
- Input mode can now be switched between `Computer Keyboard`, `MIDI Keyboard`, and `Microphone Pitch` from the HUD and start-canvas overlay.
- In `Microphone Pitch` mode, click `Connect Microphone` and play clear single notes from voice/acoustic/electric instruments to trigger invader matches without MIDI hardware.
- Computer keyboard mode now plays synthesized note audio on key press/release.

### Validation commands
- `pnpm -r lint`
- `pnpm -r test`
- `pnpm -r build`

## 1) High-level concept

A web-based 2D arcade shooter inspired by *Space Invaders*, where enemies ("invaders") each have a musical identity (note / interval / chord / pattern). The player uses a **MIDI keyboard** (or computer keyboard fallback) to **match** the required musical input to destroy invaders.

The game starts as **single-note matching**, then ramps into **intervals, chords, arpeggios, scales, and short melodies** as difficulty increases.

---

## 2) Core gameplay loop

1. Invaders spawn and move toward the player zone.
2. Each invader carries a **musical requirement** (e.g., C4, E4-G4, C major triad, C-D-E arpeggio).
3. Player plays on MIDI keyboard.
4. If the input matches the requirement within timing tolerance, the invader is destroyed (or damaged).
5. Score, combo, and difficulty adjust dynamically.
6. Waves escalate until player loses all lives or a timer ends.

---

## 3) Target platforms & constraints

* **Web-based**: Runs in Chrome/Edge/Safari modern versions.
* **MIDI**: Uses **Web MIDI API**.
* **Audio**: Game can optionally output audio feedback via **Web Audio**.
* **Low-latency**: Input recognition should feel snappy (< ~50ms perceived).
* **Accessibility**: Provide keyboard fallback and calibration options.

---

## 4) User stories (MVP → v1)

### MVP (Prototype)

* As a player, I can connect a MIDI keyboard in the browser and see a "Connected" indicator.
* As a player, I can start a game and shoot/destroy invaders by playing **single notes**.
* As a player, I can see my score, combo multiplier, and remaining lives.
* As a player, I can submit my name and save a score.
* As a player, I can view a global leaderboard.

### v1 (Expanded)

* As a player, I can play difficulty modes (Easy/Medium/Hard).
* As a player, I can unlock new musical challenges (intervals → chords → patterns).
* As a player, I can see personal stats and progression.
* As a player, I can compete in time-limited events or daily runs.

---

## 5) Detailed requirements

### 5.1 Input requirements (MIDI + fallback)

**MIDI input**

* Detect and connect MIDI devices using Web MIDI API.
* Support multiple devices, allow selecting active device.
* Parse:

  * Note On / Note Off
  * Velocity
  * Pitch bend (optional)
  * Sustain pedal (optional)

**Computer keyboard fallback**

* Default mapping supports two octaves:
  * C4 white notes: `Z X C V B N M`
  * C4 black notes: `S D G H J`
  * C5 white notes: `W E R T Y U I`
  * C5 black notes: `3 4 6 7 8`
* Allow transpose and octave shift (future setting).

**Calibration & settings**

* Transpose setting (± 12 semitones).
* Latency/timing window setting (e.g., ±150ms, ±250ms).
* Input sensitivity for velocity-based mechanics.

### 5.2 Notation and educational display (NEW)

Each invader must visually show its musical requirement as **standard staff notation**.

**Staff rendering**

* Render a 5-line staff with clef (Treble or Bass) and one or more noteheads.
* Display should be attached to the invader (above it or centered on it) and remain readable while moving.
* Support accidentals (#/b/natural) where relevant.
* Optional: show rhythmic value later; MVP can use quarter-note glyphs only.

**Clef modes**

* Provide a game setting to choose **Treble clef** or **Bass clef** (one at a time for now).
* The pitch range used for targets must adapt to the selected clef:

  * Treble: mid–upper range (e.g., C4–C6)
  * Bass: lower range (e.g., E2–C4)
* (Future) “Grand staff” mode: show both clefs (not required now).

**Educational aids (optional toggles)**

* Toggle to show note letter names under the staff (training wheels).
* Toggle to show finger numbers or scale degree hints (future).
* Practice mode: slow spawn + unlimited lives.

**Recommended client libraries for notation**

* Prefer **VexFlow** to render staff notation in **SVG/Canvas**.
* Render notation to an offscreen canvas/SVG, then attach as a texture/sprite in Phaser (or overlay SVG positioned over the invader).

### 5.3 Music matching rules

**MVP: single-note match**

* Invader requires one target pitch (MIDI note number).
* A match occurs when player plays that pitch within a time window while the invader is alive.

**Expanded rules**

* **Intervals**: two notes within a short window, order optional or required.
* **Chords**: all notes pressed together (or within a small chord window, e.g., 80–120ms).
* **Arpeggios**: ordered note sequence within a window.
* **Scales**: match N notes of a scale segment.
* **Melody bosses**: short motif to defeat boss.

**Tolerance handling**

* Configurable time window for sequences.
* Optional pitch tolerance modes:

  * Strict: exact pitch
  * Key/scale-aware: allow enharmonic or diatonic substitutions (advanced)

### 5.3 Game mechanics

**Entities**

* Player ship (bottom)
* Invaders (multiple types)
* Projectiles/Effects (visual confirmation, but not required as a classic shooter since notes are the "shots")
* Power-ups

**Invader behavior**

* Spawn patterns: rows, corners, spirals, diagonals.
* Movement: classic horizontal drift + drop, or multi-directional for later levels.
* Attack patterns: optional (invader bullets) for higher difficulty.

**Difficulty scaling**

* Increase spawn rate, movement speed, pattern complexity.
* Introduce new musical requirement types progressively.
* Dynamic difficulty: adapt based on accuracy/combo.

**Scoring**

* Base points per invader.
* Multipliers for streaks.
* Bonuses:

  * Perfect timing
  * Correct velocity range
  * Chord accuracy

**Lose conditions**

* Invader reaches bottom line
* Player hit by projectiles (if enabled)
* Timer ends (time attack mode)

### 5.4 UI/UX requirements

* Start screen:

  * Connect MIDI
  * Choose difficulty
  * Settings (transpose, latency window, input mode)
* In-game HUD:

  * Score, combo, lives
  * Wave/level indicator
  * MIDI note display (last played)
  * Optional "required notes" overlay for accessibility
* End screen:

  * Final score
  * Submit name
  * Leaderboard preview

### 5.5 Backend requirements

**Core backend features**

* Persist scores and leaderboard.
* Support authentication (optional MVP), at minimum anonymous score submission with abuse controls.
* Store game sessions (optional) for anti-cheat and analytics.

**Data to store**

* User

  * id, displayName, createdAt
* Score submission

  * id, userId (nullable), displayName snapshot, score, mode, difficulty, seed, duration, accuracy, createdAt
* Leaderboard views

  * Top scores by mode/difficulty/time window

**Anti-cheat (pragmatic)**

* Server-side validation heuristics:

  * Max plausible score per minute
  * Require session token started by server
  * Optional: store event hashes / lightweight replay signature

**APIs (example)**

* `POST /api/sessions/start` → returns sessionId + seed
* `POST /api/scores/submit` → submit score with sessionId
* `GET /api/leaderboards?mode=classic&difficulty=easy&period=weekly`
* `GET /api/me/stats` (if auth)

### 5.6 Online / multiplayer (future)

Not required for MVP, but design for it.

* Real-time “duel” mode: both players face same seed and compete.
* Co-op harmony mode: players must play complementary notes (e.g., 3rds/5ths) to trigger mega attacks.

---

## 6) Recommended technology stack (web-based)

### Frontend game client

**Recommended (fast iteration):**

* **TypeScript**
* **React** for UI menus + overlays
* **Phaser 3** as the 2D game engine
* **Web MIDI API** for MIDI input
* **VexFlow** for staff notation rendered as **SVG**
* **Web Audio API** (optional) for feedback tones
* State management: Zustand (lightweight) or React Context for settings

### Backend (default recommendation)

* **Node.js (TypeScript) + Fastify** (or NestJS)
* **PostgreSQL**
* **Prisma** ORM
* Auth: optional for MVP (anonymous submissions + abuse controls)
* Hosting: Fly.io / Render / Railway

### Testing

* **Vitest** for frontend/unit tests
* **Supertest** (or Fastify inject) for API tests
* **Playwright** for E2E smoke (later)

---

## 7) Library choices (client)

* Game: `phaser`
* MIDI: native Web MIDI API + small wrapper utilities (or `webmidi` library for convenience)
* Audio: native Web Audio + optional synth: `tone` (Tone.js)
* UI: React + `@radix-ui` (or any component library)
* Build tooling: Vite

---

## 8) Step-by-step build plan (MVP first)

### Phase 0 — Repo + skeleton (0.5–1 day)

1. Create mono-repo (or two repos) with:

   * `apps/web` (Phaser + React)
   * `apps/api` (NestJS/Fastify)
2. Configure CI, lint, formatting.

### Phase 1 — Web MIDI connection + input visualizer (1–2 days)

1. Build MIDI connection panel:

   * Request MIDI access
   * List devices
   * Select active device
2. Create input visualizer:

   * Show last note played (name + octave)
   * Maintain a short rolling buffer of recent notes with timestamps
3. Add keyboard fallback.

### Phase 2 — Game prototype: invaders + note-to-kill (2–4 days)

1. Phaser scene setup:

   * Main menu scene
   * Game scene
   * Game over scene
2. Spawn invaders in a simple row formation.
3. Each invader has a `requiredNote`.
4. Matching engine:

   * On NoteOn, check if there’s an invader requiring that pitch
   * Choose closest / oldest / highest priority invader
   * Destroy invader + score
5. Basic lose condition: invader reaches bottom.

### Phase 3 — Score submission + leaderboard (2–4 days)

1. API: session start endpoint returns `sessionId` and `seed`.
2. Client starts game using seed.
3. On game end, client submits score with sessionId + stats.
4. Leaderboard endpoint + UI.

### Phase 4 — Difficulty scaling (2–4 days)

1. Add difficulty presets:

   * Easy: slower, fewer notes
   * Medium: faster, more notes
   * Hard: multiple spawn points
2. Add dynamic spawn rate and speed ramp.
3. Add combo multiplier.

### Phase 5 — Musical depth (v1) (ongoing)

1. Add interval invaders.
2. Add chord invaders.
3. Add arpeggio invaders.
4. Add boss melody pattern.

---

## 9) Architecture notes (client)

### Game modules

* `InputManager`

  * MIDI + keyboard
  * emits events: `NOTE_ON`, `NOTE_OFF`
* `MusicMatcher`

  * consumes note events
  * maintains rolling buffer and recognizes patterns
  * returns matches against invader requirements
* `Spawner`

  * creates waves based on seed + difficulty
* `DifficultyDirector`

  * updates spawn rate, speed, pattern complexity
* `Scoring`

  * calculates points and combo

### Deterministic runs (important for fairness)

* Use seeded RNG so the same seed produces identical waves.
* Store seed in backend session.

---

## 10) Database sketch (Postgres)

### Tables

* `users` (optional for MVP)
* `game_sessions`

  * `id`, `seed`, `mode`, `difficulty`, `created_at`, `expires_at`
* `score_submissions`

  * `id`, `session_id`, `display_name`, `score`, `accuracy`, `duration_ms`, `created_at`

Indexes:

* `(mode, difficulty, score DESC)`
* `(created_at)`

---

## 11) MVP acceptance criteria

* Works in a modern browser.
* MIDI device can be selected and notes are detected.
* Invaders spawn and can be destroyed by matching the required single note.
* Score updates in real time.
* Game ends reliably.
* Score can be saved and appears on a leaderboard.

---

## 12) A “prompt” you can paste into a code generator (Codex/LLM) to build it

Copy/paste and iterate section-by-section.

### Prompt 0 — Repo rules & lifecycle gates

Read `AGENTS.md`, `PLANS.md`, and `BACKLOG.md` before making changes. For any task:

1. Restate the acceptance criteria.
2. Write or update tests first where practical.
3. Implement the smallest change to pass tests.
4. Run: lint + unit tests + (if relevant) integration tests.
5. Summarize changes + list commands run.

### Prompt 1 — Create the web game skeleton

* Create a Vite + React + TypeScript project.
* Add Phaser 3.
* Implement 3 scenes: `BootScene`, `MenuScene`, `GameScene`.
* Render Menu UI with React overlay (start game button, MIDI status).
* GameScene should display a player ship at the bottom and spawn placeholder invaders.

### Prompt 2 — MIDI input + event bus

* Implement a `MidiService` using Web MIDI API.
* Provide: request access, list devices, select device, subscribe to note events.
* Emit events via a simple event bus.
* Add keyboard fallback mapping.

### Prompt 3 — Note-to-invader matching

* Add invader entity with `requiredNote`.
* On NoteOn: find matching invader and destroy it.
* Add score + combo.

### Prompt 4 — Backend API for scores

* Build a small API service (Fastify or NestJS) with PostgreSQL.
* Implement endpoints:

  * `POST /api/sessions/start`
  * `POST /api/scores/submit`
  * `GET /api/leaderboards`
* Add validation + basic abuse checks.

### Prompt 5 — Connect client to backend

* Start session when player hits Start.
* Use returned seed to spawn consistent waves.
* Submit score on game over.
* Display leaderboard.

---

## 13) Next-step checklist (what you should do first)

1. Decide backend choice: **Node (NestJS/Fastify)** vs **Laravel**.
2. Start with MVP: **single-note invaders** + **leaderboard**.
3. Add intervals/chords only after MVP feels fun.

---

If you want, I can also generate:

* A concrete file/folder structure
* A full API spec (OpenAPI)
* Seeded wave generator design
* MusicMatcher algorithms for chords/arpeggios

---

## Codex workflow files (added to repo)

* `AGENTS.md` — how Codex should operate in this codebase (definition of done, commands to run)
* `PLANS.md` — milestones and checkpoints for MVP → v1
* `BACKLOG.md` — small, testable tasks for steady progress
* `docs/DEPLOYMENT.md` — VM hosting, SSL (Caddy), and GitHub Actions CI/CD deploy setup
