import { describe, expect, it } from 'vitest';
import { PitchMatcher } from '@/game/systems/pitchMatcher';
import type { InvaderEntity } from '@/types/gameplay';

const makeInvader = (
  id: string,
  pattern: number[],
  x: number,
  y: number,
): InvaderEntity => ({
  id,
  note: pattern[0] ?? 60,
  pattern,
  requiredNotes: [pattern[0] ?? 60],
  targetType: 'pattern',
  points: 100,
  clef: 'treble',
  x,
  y,
  vx: 0,
  vy: 0,
  speed: 0,
  spawnedAt: 0,
});

describe('pitch matcher', () => {
  it('advances ordered notes and returns hit on final note', () => {
    const matcher = new PitchMatcher(1500);
    const invader = makeInvader('a', [60, 62], 420, 270);

    const first = matcher.matchNote({
      invaders: [invader],
      note: 60,
      now: 100,
      centerX: 360,
      centerY: 270,
    });
    const second = matcher.matchNote({
      invaders: [invader],
      note: 62,
      now: 300,
      centerX: 360,
      centerY: 270,
    });

    expect(first.kind).toBe('progress');
    expect(first.target?.id).toBe('a');
    expect(second.kind).toBe('hit');
    expect(second.target?.id).toBe('a');
  });

  it('chooses nearest threat when multiple invaders share the same expected note', () => {
    const matcher = new PitchMatcher(1500);
    const invaders = [
      makeInvader('far', [60, 62], 520, 270),
      makeInvader('near', [60, 64], 390, 270),
    ];

    const result = matcher.matchNote({
      invaders,
      note: 60,
      now: 120,
      centerX: 360,
      centerY: 270,
    });

    expect(result.kind).toBe('progress');
    expect(result.target?.id).toBe('near');
  });

  it('resets in-progress states on miss', () => {
    const matcher = new PitchMatcher(1500);
    const invaders = [makeInvader('a', [60, 62], 430, 270)];

    matcher.matchNote({
      invaders,
      note: 60,
      now: 100,
      centerX: 360,
      centerY: 270,
    });
    const miss = matcher.matchNote({
      invaders,
      note: 65,
      now: 300,
      centerX: 360,
      centerY: 270,
    });
    const afterReset = matcher.matchNote({
      invaders,
      note: 62,
      now: 500,
      centerX: 360,
      centerY: 270,
    });

    expect(miss.kind).toBe('miss');
    expect(afterReset.kind).toBe('miss');
  });

  it('resets progress after the sequence window expires', () => {
    const matcher = new PitchMatcher(1500);
    const invaders = [makeInvader('a', [60, 62], 430, 270)];

    matcher.matchNote({
      invaders,
      note: 60,
      now: 100,
      centerX: 360,
      centerY: 270,
    });
    matcher.syncInvaders(invaders, 1701);
    const afterTimeout = matcher.matchNote({
      invaders,
      note: 62,
      now: 1750,
      centerX: 360,
      centerY: 270,
    });

    expect(afterTimeout.kind).toBe('miss');
  });
});
