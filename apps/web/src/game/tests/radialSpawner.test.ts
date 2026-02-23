import { describe, expect, it } from 'vitest';
import { createArenaConfig } from '@/game/arenaConfig';
import {
  buildRadialInvader,
  computeMaxInvaders,
  computeSpawnIntervalMs,
  distanceToCore,
} from '@/game/systems/radialSpawner';

describe('radial spawner', () => {
  it('spawns invaders inside canvas bounds and outside the core radius', () => {
    const config = createArenaConfig();
    const invader = buildRadialInvader({
      config,
      id: 'inv-1',
      note: 60,
      wave: 1,
      now: 0,
      random: () => 0,
    });

    expect(invader.x).toBeGreaterThan(0);
    expect(invader.x).toBeLessThan(config.width);
    expect(invader.y).toBeGreaterThan(0);
    expect(invader.y).toBeLessThan(config.height);
    expect(distanceToCore(invader, config)).toBeGreaterThan(config.coreRadius);
  });

  it('sets velocity toward the arena center', () => {
    const config = createArenaConfig();
    const invader = buildRadialInvader({
      config,
      id: 'inv-2',
      note: 64,
      wave: 1,
      now: 0,
      random: () => 0.25,
    });

    const towardCenterX = config.centerX - invader.x;
    const towardCenterY = config.centerY - invader.y;
    const dot = towardCenterX * invader.vx + towardCenterY * invader.vy;

    expect(dot).toBeGreaterThan(0);
  });

  it('applies wave scaling and spawn floor correctly', () => {
    const config = createArenaConfig();

    expect(computeMaxInvaders(config, 1)).toBe(1);
    expect(computeMaxInvaders(config, 4)).toBe(4);

    const wave1 = computeSpawnIntervalMs(config, 1);
    const wave20 = computeSpawnIntervalMs(config, 20);

    expect(wave1).toBe(2100);
    expect(wave20).toBeGreaterThanOrEqual(350);
  });

  it('caps pitch mode concurrent invaders to the configured maximum', () => {
    const config = createArenaConfig(720, 540, 3, {
      mode: 'pitch',
    });

    expect(computeMaxInvaders(config, 1)).toBe(3);
    expect(computeMaxInvaders(config, 10)).toBe(3);
  });
});
