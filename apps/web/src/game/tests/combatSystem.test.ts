import { describe, expect, it } from 'vitest';
import { createArenaConfig } from '@/game/arenaConfig';
import { createLaserShot } from '@/game/systems/combatSystem';

describe('combat system', () => {
  it('creates a laser from core center to target point', () => {
    const config = createArenaConfig();

    const laser = createLaserShot({
      id: 'laser-1',
      config,
      toX: 500,
      toY: 120,
      now: 200,
    });

    expect(laser.fromX).toBe(config.centerX);
    expect(laser.fromY).toBe(config.centerY);
    expect(laser.expiresAt).toBe(320);
  });
});
