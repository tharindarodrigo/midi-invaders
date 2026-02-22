import { describe, expect, it } from 'vitest';
import { createArenaConfig } from '@/game/arenaConfig';
import { applyMissCooldown, createLaserShot, isWeaponCoolingDown } from '@/game/systems/combatSystem';
import type { ArenaState } from '@/types/gameplay';

const makeState = (): ArenaState => ({
  score: 0,
  wave: 1,
  lives: 3,
  gameOver: false,
  hitsThisWave: 0,
  weaponCooldownUntil: 0,
  invaders: [],
  lasers: [],
});

describe('combat system', () => {
  it('applies cooldown and blocks firing during lockout window', () => {
    const config = createArenaConfig();
    const state = makeState();

    applyMissCooldown(state, config, 1000);

    expect(state.weaponCooldownUntil).toBe(1350);
    expect(isWeaponCoolingDown(state, 1100)).toBe(true);
    expect(isWeaponCoolingDown(state, 1400)).toBe(false);
  });

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
