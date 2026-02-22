import { describe, expect, it } from 'vitest';
import { createArenaConfig } from '@/game/arenaConfig';
import { GameStateSystem } from '@/game/systems/gameStateSystem';
import type { InvaderEntity } from '@/types/gameplay';

const makeInvader = (
  id: string,
  note: number,
  x: number,
  y: number,
  vx = 0,
  vy = 0,
): InvaderEntity => ({
  id,
  note,
  x,
  y,
  vx,
  vy,
  speed: Math.hypot(vx, vy),
  spawnedAt: 0,
});

describe('game state system', () => {
  it('seeds the first wave using level 1 cap', () => {
    const config = createArenaConfig();
    const system = new GameStateSystem(config, () => 0.3);
    system.reset(0);

    expect(system.getState().invaders).toHaveLength(4);
  });

  it('destroys one matching invader and increments score on correct note', () => {
    const config = createArenaConfig();
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.addInvaderForTest(makeInvader('target', 60, config.centerX + 100, config.centerY));

    const result = system.processNote(60, 10);
    const state = system.getState();

    expect(result.kind).toBe('hit');
    expect(result.target?.id).toBe('target');
    expect(state.score).toBe(100);
    expect(state.invaders).toHaveLength(0);
    expect(state.lasers).toHaveLength(1);
  });

  it('applies miss cooldown and blocks immediate follow-up notes', () => {
    const config = createArenaConfig();
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.addInvaderForTest(makeInvader('target', 62, config.centerX + 100, config.centerY));

    const miss = system.processNote(61, 100);
    const blocked = system.processNote(62, 200);

    expect(miss.kind).toBe('miss');
    expect(blocked.kind).toBe('cooldown');
    expect(system.getState().invaders).toHaveLength(1);
  });

  it('decrements lives when invaders reach core and ends game at zero lives', () => {
    const config = createArenaConfig();
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.addInvaderForTest(makeInvader('a', 60, config.centerX + 10, config.centerY));
    system.addInvaderForTest(makeInvader('b', 61, config.centerX, config.centerY + 10));
    system.addInvaderForTest(makeInvader('c', 62, config.centerX - 10, config.centerY));

    const step = system.step(16, 16);
    const state = system.getState();

    expect(step.reachedCore).toHaveLength(3);
    expect(state.lives).toBe(0);
    expect(state.gameOver).toBe(true);
  });
});
