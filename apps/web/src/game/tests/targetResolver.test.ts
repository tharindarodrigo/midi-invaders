import { describe, expect, it } from 'vitest';
import { resolveNearestThreatTarget } from '@/game/systems/targetResolver';
import type { InvaderEntity } from '@/types/gameplay';

const makeInvader = (id: string, note: number, x: number, y: number): InvaderEntity => ({
  id,
  note,
  pattern: [note],
  x,
  y,
  vx: 0,
  vy: 0,
  speed: 0,
  spawnedAt: 0,
});

describe('target resolver', () => {
  it('returns one target when multiple invaders share a note', () => {
    const invaders = [
      makeInvader('a', 60, 460, 270),
      makeInvader('b', 60, 380, 270),
      makeInvader('c', 64, 340, 270),
    ];

    const resolution = resolveNearestThreatTarget({
      invaders,
      note: 60,
      centerX: 360,
      centerY: 270,
    });

    expect(resolution.matched).toBe(true);
    expect(resolution.target?.id).toBe('b');
  });

  it('returns no target when no note match exists', () => {
    const resolution = resolveNearestThreatTarget({
      invaders: [makeInvader('z', 67, 420, 280)],
      note: 60,
      centerX: 360,
      centerY: 270,
    });

    expect(resolution.matched).toBe(false);
    expect(resolution.target).toBeNull();
  });
});
