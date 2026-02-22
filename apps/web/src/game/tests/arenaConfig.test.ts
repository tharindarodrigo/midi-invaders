import { describe, expect, it } from 'vitest';
import { createArenaConfig } from '@/game/arenaConfig';

describe('arena config difficulty presets', () => {
  it('sets level 1 to very slow and starts with one invader', () => {
    const level1 = createArenaConfig(1200, 800, 1);

    expect(level1.baseInvaderSpeed).toBe(20);
    expect(level1.baseMaxInvaders).toBe(1);
    expect(level1.baseSpawnIntervalMs).toBe(2100);
  });

  it('scales up challenge across levels', () => {
    const level1 = createArenaConfig(1200, 800, 1);
    const level3 = createArenaConfig(1200, 800, 3);

    expect(level3.baseInvaderSpeed).toBeGreaterThan(level1.baseInvaderSpeed);
    expect(level3.baseMaxInvaders).toBeGreaterThan(level1.baseMaxInvaders);
    expect(level3.baseSpawnIntervalMs).toBeLessThan(level1.baseSpawnIntervalMs);
  });
});
