

# MIDI Invaders (Web)

A web-based 2D arcade + educational game inspired by *Space Invaders*, where you destroy invaders by playing the correct notes (and later intervals/chords/patterns) on a **MIDI keyboard**.

## Core idea
- Invaders spawn and move toward the player.
- Each invader has a **musical requirement** (MVP: single note).
- You play the required note on a MIDI keyboard (or keyboard fallback) to destroy the invader.
- The game ramps difficulty over time and tracks score + accuracy.

---

## Notation display (staff + clef) — DOM/SVG Overlay (Chosen Approach A)
We will display each target note using **standard staff notation** (5-line staff + clef + notehead, optional accidentals) using an **SVG overlay** rendered by **VexFlow**.

### Why DOM/SVG overlay?
- Crisp, readable notation (SVG stays sharp at any scale)
- Fast iteration: VexFlow renders music notation directly
- Clean integration with Phaser via DOM elements

### Implementation plan
1. **Enable Phaser DOM support**
   - In Phaser config, set:
     - `dom: { createContainer: true }`
2. **Render notation with VexFlow**
   - Create a `NotationRenderer` module that:
     - accepts `clef` (`treble` | `bass`), note(s), and optional chord arrays
     - renders an SVG staff with clef + glyphs
     - re-renders only when the target notes change (not every frame)
3. **Attach notation to game objects**
   - Use `Phaser.GameObjects.DOMElement` to mount the SVG into the Phaser DOM container.
   - In `update()`, position the DOM element to follow the invader (or HUD lane).

### Recommended UI pattern (readability + performance)
Instead of drawing a full staff on every invader (which gets cluttered), we’ll start with a **single shared “Notation Lane” HUD**:
- **Staff lines + clef are drawn once** (top HUD)
- The next **N targets** (e.g., 5–8) are shown clearly in order
- Invaders in the playfield can have a simple icon/color marker, while the HUD provides the full notation

This keeps the game readable and strongly educational.

### Clef modes
- Start with **Treble clef** for MVP
- Add **Bass clef** as a selectable mode (one at a time)
- Pitch ranges adapt to the clef:
  - Treble: ~ C4–C6
  - Bass: ~ E2–C4

### Training wheels (optional toggles)
- Show/hide note letter names under the staff
- Practice mode (slower spawn, unlimited lives)

### Performance notes
- Do **not** re-render VexFlow SVG every tick
- Pool/reuse DOM nodes for spawned/despawned targets
- Only update DOM position each frame; only re-render on note changes

---

## MVP scope (first playable prototype)
- Web MIDI connect + device select
- Keyboard fallback mapping
- One game mode with **single-note** invaders
- **Notation Lane HUD** (treble clef)
- Score + accuracy
- Game over screen
- Backend score submission + leaderboard

---

## Suggested stack
- **Frontend**: TypeScript, Phaser 3, Vite, VexFlow (SVG), Web MIDI API
- **Backend**: Node.js (TypeScript) + Fastify/NestJS + PostgreSQL (or Laravel API if preferred)

---

## Next steps
1. Bootstrap the Phaser + Vite + TS project
2. Build MIDI input service + note event bus
3. Build GameScene with invader spawner + single-note matching
4. Add Notation Lane using VexFlow SVG + Phaser DOMElement overlay
5. Add score submission + leaderboard API