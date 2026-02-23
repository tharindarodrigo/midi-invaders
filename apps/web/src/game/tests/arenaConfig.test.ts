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

  it('uses a C2..C4 note pool for level 2 bass-clef training', () => {
    const level2 = createArenaConfig(1200, 800, 2);

    expect(level2.notePool[0]).toBe(36);
    expect(level2.notePool[level2.notePool.length - 1]).toBe(60);
    expect(level2.notePool).toContain(48);
    expect(level2.notePool).toContain(60);
  });

  it('keeps level 2 pacing slower with fewer simultaneous invaders', () => {
    const level2 = createArenaConfig(1200, 800, 2);

    expect(level2.baseInvaderSpeed).toBe(24);
    expect(level2.baseMaxInvaders).toBe(3);
    expect(level2.baseSpawnIntervalMs).toBe(1800);
    expect(level2.spawnIntervalDecay).toBe(0.978);
  });

  it('builds practice mode config with custom clef range, speed, and infinite lives', () => {
    const practice = createArenaConfig(1200, 800, 2, {
      mode: 'practice',
      clefMode: 'any',
      speedMultiplier: 0.75,
      livesMode: 'infinite',
    });

    expect(practice.mode).toBe('practice');
    expect(practice.clefMode).toBe('any');
    expect(practice.notePool[0]).toBe(36);
    expect(practice.notePool[practice.notePool.length - 1]).toBe(84);
    expect(practice.baseInvaderSpeed).toBe(18);
    expect(practice.baseSpawnIntervalMs).toBe(2400);
    expect(practice.infiniteLives).toBe(true);
    expect(practice.lifeUpsEnabled).toBe(false);
    expect(practice.startingLives).toBe(Number.POSITIVE_INFINITY);
  });

  it('builds pitch mode config with level-based pattern length, cap, and miss penalty', () => {
    const level1 = createArenaConfig(1200, 800, 1, { mode: 'pitch' });
    const level2 = createArenaConfig(1200, 800, 2, { mode: 'pitch' });
    const level3 = createArenaConfig(1200, 800, 3, { mode: 'pitch' });
    const arcadeLevel2 = createArenaConfig(1200, 800, 2, { mode: 'arcade' });

    expect(level1.mode).toBe('pitch');
    expect(level1.patternLength).toBe(1);
    expect(level1.maxConcurrentInvaders).toBe(1);
    expect(level1.missPenaltyPoints).toBe(25);

    expect(level2.patternLength).toBe(2);
    expect(level2.maxConcurrentInvaders).toBe(1);
    expect(level3.patternLength).toBe(3);
    expect(level3.maxConcurrentInvaders).toBe(3);
    expect(level2.baseInvaderSpeed).toBeLessThan(arcadeLevel2.baseInvaderSpeed);
    expect(level2.baseSpawnIntervalMs).toBeGreaterThan(arcadeLevel2.baseSpawnIntervalMs);
    expect(level2.promptRepeatMs).toBeGreaterThan(2200);
  });

  it('keeps non-pitch mode penalty unchanged', () => {
    const arcade = createArenaConfig(1200, 800, 1, { mode: 'arcade' });
    expect(arcade.missPenaltyPoints).toBe(50);
  });
});
