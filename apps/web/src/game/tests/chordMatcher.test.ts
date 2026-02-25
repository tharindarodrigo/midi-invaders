import { describe, expect, it } from 'vitest';
import { ChordMatcher } from '@/game/systems/chordMatcher';
import type { InvaderEntity } from '@/types/gameplay';

const makeChordInvader = (
  id: string,
  requiredNotes: number[],
  x: number,
  y: number,
): InvaderEntity => ({
  id,
  note: requiredNotes[0] ?? 60,
  pattern: [requiredNotes[0] ?? 60],
  requiredNotes,
  targetType: 'chord',
  points: 200,
  clef: 'treble',
  x,
  y,
  vx: 0,
  vy: 0,
  speed: 0,
  spawnedAt: 0,
});

describe('chord matcher', () => {
  it('matches triads within the simultaneous window regardless of note order', () => {
    const matcher = new ChordMatcher(120, 900);
    const invader = makeChordInvader('c-major', [60, 64, 67], 400, 270);

    const first = matcher.matchChord({
      invaders: [invader],
      note: 67,
      now: 100,
      centerX: 360,
      centerY: 270,
    });
    const second = matcher.matchChord({
      invaders: [invader],
      note: 60,
      now: 150,
      centerX: 360,
      centerY: 270,
    });
    const third = matcher.matchChord({
      invaders: [invader],
      note: 64,
      now: 190,
      centerX: 360,
      centerY: 270,
    });

    expect(first.kind).toBe('progress');
    expect(second.kind).toBe('progress');
    expect(third.kind).toBe('hit');
    expect(third.target?.id).toBe('c-major');
  });

  it('matches an ascending arpeggio inside the arpeggio window', () => {
    const matcher = new ChordMatcher(120, 900);
    const invader = makeChordInvader('f-major', [65, 69, 72], 400, 270);

    matcher.matchChord({
      invaders: [invader],
      note: 65,
      now: 100,
      centerX: 360,
      centerY: 270,
    });
    matcher.matchChord({
      invaders: [invader],
      note: 69,
      now: 420,
      centerX: 360,
      centerY: 270,
    });
    const result = matcher.matchChord({
      invaders: [invader],
      note: 72,
      now: 760,
      centerX: 360,
      centerY: 270,
    });

    expect(result.kind).toBe('hit');
    expect(result.target?.id).toBe('f-major');
  });

  it('returns progress for partial chord input and miss for unrelated notes', () => {
    const matcher = new ChordMatcher(120, 900);
    const invader = makeChordInvader('g-major', [67, 71, 74], 420, 270);

    const progress = matcher.matchChord({
      invaders: [invader],
      note: 67,
      now: 100,
      centerX: 360,
      centerY: 270,
    });
    const miss = matcher.matchChord({
      invaders: [invader],
      note: 60,
      now: 150,
      centerX: 360,
      centerY: 270,
    });

    expect(progress.kind).toBe('progress');
    expect(progress.target?.id).toBe('g-major');
    expect(miss.kind).toBe('miss');
    expect(miss.target).toBeNull();
  });

  it('accepts semitone drift when tolerance is enabled', () => {
    const matcher = new ChordMatcher(120, 900);
    const invader = makeChordInvader('c-major', [60, 64, 67], 420, 270);

    matcher.matchChord({
      invaders: [invader],
      note: 59,
      now: 100,
      centerX: 360,
      centerY: 270,
      noteToleranceSemitones: 1,
    });
    matcher.matchChord({
      invaders: [invader],
      note: 64,
      now: 170,
      centerX: 360,
      centerY: 270,
      noteToleranceSemitones: 1,
    });
    const result = matcher.matchChord({
      invaders: [invader],
      note: 67,
      now: 240,
      centerX: 360,
      centerY: 270,
      noteToleranceSemitones: 1,
    });

    expect(result.kind).toBe('hit');
    expect(result.target?.id).toBe('c-major');
  });

  it('supports longer arpeggio windows when overridden', () => {
    const matcher = new ChordMatcher(120, 900);
    const invader = makeChordInvader('d-major', [62, 66, 69], 420, 270);

    matcher.matchChord({
      invaders: [invader],
      note: 62,
      now: 100,
      centerX: 360,
      centerY: 270,
      arpeggioWindowMs: 1800,
    });
    matcher.matchChord({
      invaders: [invader],
      note: 66,
      now: 850,
      centerX: 360,
      centerY: 270,
      arpeggioWindowMs: 1800,
    });
    const result = matcher.matchChord({
      invaders: [invader],
      note: 69,
      now: 1600,
      centerX: 360,
      centerY: 270,
      arpeggioWindowMs: 1800,
    });

    expect(result.kind).toBe('hit');
    expect(result.target?.id).toBe('d-major');
  });

  it('selects nearest threat when multiple chord targets match', () => {
    const matcher = new ChordMatcher(120, 900);
    const invaders = [
      makeChordInvader('far', [60, 64, 67], 520, 270),
      makeChordInvader('near', [60, 64, 67], 390, 270),
    ];

    matcher.matchChord({
      invaders,
      note: 60,
      now: 100,
      centerX: 360,
      centerY: 270,
    });
    matcher.matchChord({
      invaders,
      note: 64,
      now: 150,
      centerX: 360,
      centerY: 270,
    });
    const result = matcher.matchChord({
      invaders,
      note: 67,
      now: 190,
      centerX: 360,
      centerY: 270,
    });

    expect(result.kind).toBe('hit');
    expect(result.target?.id).toBe('near');
  });
});
