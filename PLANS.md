# PLANS.md — MIDI Invaders Plan (MVP → v1)

## North Star
A web-based arcade + educational game that improves note-reading and technique through fun, high-frequency repetition.

## MVP (Playable Prototype)
### Goal
Single-note invaders + notation lane (treble) + scores + leaderboard.

### Deliverables
- Web client
  - Phaser scenes: Boot / Menu / Game / Game Over
  - MIDI connect + device select + keyboard fallback
  - Single-note matching destroys invaders
  - Score + combo + lives
  - Notation Lane HUD (VexFlow SVG overlay, treble clef)
- Backend
  - Start session (seed)
  - Submit score
  - Leaderboard

### Acceptance checks
- MIDI input works in modern Chromium browsers
- Game loop stable (no crashes on restart)
- Notation lane updates correctly when targets change
- Score submission + leaderboard works end-to-end

## v1 (Educational Depth)
### Add musical challenges
- Intervals
- Chords (triads)
- Arpeggios
- Boss patterns (short motifs)

### Add learning features
- Practice mode (slow spawn, unlimited lives)
- Training wheels toggle (show/hide note names)
- Basic mastery stats per note (accuracy + reaction time)
- Daily challenge (same seed for everyone)

## vNext (Online / Competitive)
- Duel mode (same seed, race for score)
- Anti-cheat heuristics (max score/min, server-minted sessions)
- Optional auth for persistent profiles
- E2E tests (Playwright smoke)