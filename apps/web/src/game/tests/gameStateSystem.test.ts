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
  pattern: number[] = [note],
): InvaderEntity => ({
  id,
  note,
  pattern,
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

    expect(system.getState().invaders).toHaveLength(1);
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
    expect(result.scoreDelta).toBe(config.basePoints);
    expect(result.powerUp.activated).toBe(false);
    expect(result.powerUp.destroyedInvaders).toHaveLength(0);
    expect(state.score).toBe(100);
    expect(state.lifeScore).toBe(100);
    expect(state.invaders).toHaveLength(0);
    expect(state.lasers).toHaveLength(1);
  });

  it('applies miss penalty and allows immediate follow-up notes', () => {
    const config = createArenaConfig();
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.addInvaderForTest(makeInvader('target', 62, config.centerX + 100, config.centerY));

    const miss = system.processNote(61, 100);
    const hit = system.processNote(62, 200);

    expect(miss.kind).toBe('miss');
    expect(miss.scoreDelta).toBe(-50);
    expect(miss.powerUp.activated).toBe(false);
    expect(hit.kind).toBe('hit');
    expect(hit.scoreDelta).toBe(config.basePoints);
    expect(system.getState().score).toBe(50);
    expect(system.getState().lifeScore).toBe(100);
    expect(system.getState().invaders).toHaveLength(0);
  });

  it('awards one extra life for each 1000 life-score and keeps the remainder', () => {
    const config = createArenaConfig();
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.getState().lifeScore = 950;
    system.addInvaderForTest(makeInvader('target', 60, config.centerX + 100, config.centerY));

    const hit = system.processNote(60, 10);
    const state = system.getState();

    expect(hit.kind).toBe('hit');
    expect(hit.powerUp.activated).toBe(true);
    expect(state.lives).toBe(config.startingLives + 1);
    expect(state.lifeScore).toBe(50);
    expect(state.score).toBe(100);
  });

  it('power-up destroys the nearest five invaders from center when life-up is earned', () => {
    const config = createArenaConfig();
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.getState().lifeScore = 900;
    system.addInvaderForTest(makeInvader('target', 60, config.centerX + 180, config.centerY));
    system.addInvaderForTest(makeInvader('a', 61, config.centerX + 20, config.centerY));
    system.addInvaderForTest(makeInvader('b', 62, config.centerX + 30, config.centerY));
    system.addInvaderForTest(makeInvader('c', 63, config.centerX + 40, config.centerY));
    system.addInvaderForTest(makeInvader('d', 64, config.centerX + 50, config.centerY));
    system.addInvaderForTest(makeInvader('e', 65, config.centerX + 60, config.centerY));
    system.addInvaderForTest(makeInvader('f', 66, config.centerX + 220, config.centerY));

    const hit = system.processNote(60, 10);
    const state = system.getState();
    const destroyedIds = hit.powerUp.destroyedInvaders.map((invader) => invader.id);

    expect(hit.kind).toBe('hit');
    expect(hit.powerUp.activated).toBe(true);
    expect(destroyedIds).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(state.invaders.map((invader) => invader.id)).toEqual(['f']);
    expect(state.lives).toBe(config.startingLives + 1);
    expect(state.lifeScore).toBe(0);
  });

  it('floors life-score at zero on penalties and never removes lives from penalties', () => {
    const config = createArenaConfig();
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.getState().lifeScore = 980;
    system.addInvaderForTest(makeInvader('target', 60, config.centerX + 100, config.centerY));
    system.processNote(60, 10);

    const livesAfterLifeUp = system.getState().lives;
    const miss = system.processNote(61, 100);

    expect(miss.kind).toBe('miss');
    expect(system.getState().lives).toBe(livesAfterLifeUp);
    expect(system.getState().lifeScore).toBe(30);

    system.getState().lifeScore = 20;
    system.processNote(61, 200);
    expect(system.getState().lifeScore).toBe(0);
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

  it('shifts spawn timers when gameplay is frozen', () => {
    const config = createArenaConfig();
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.delayTimersForFreeze(1000);

    const beforeFreezeRelease = system.step(2100, 16);
    const afterFreezeRelease = system.step(3100, 16);

    expect(beforeFreezeRelease.spawned).toHaveLength(0);
    expect(afterFreezeRelease.spawned).toHaveLength(1);
  });

  it('disables life-up meter progress and pulse power-up for infinite-lives practice mode', () => {
    const config = createArenaConfig(720, 540, 2, {
      mode: 'practice',
      clefMode: 'any',
      speedMultiplier: 1,
      livesMode: 'infinite',
    });
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.getState().lifeScore = 950;
    system.addInvaderForTest(makeInvader('target', 60, config.centerX + 100, config.centerY));

    const hit = system.processNote(60, 10);

    expect(hit.kind).toBe('hit');
    expect(hit.powerUp.activated).toBe(false);
    expect(hit.powerUp.destroyedInvaders).toHaveLength(0);
    expect(system.getState().lifeScore).toBe(0);
    expect(system.getState().lives).toBe(Number.POSITIVE_INFINITY);
  });

  it('keeps infinite-lives practice mode running when invaders reach core', () => {
    const config = createArenaConfig(720, 540, 2, {
      mode: 'practice',
      clefMode: 'bass',
      speedMultiplier: 1,
      livesMode: 'infinite',
    });
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.addInvaderForTest(makeInvader('a', 40, config.centerX + 10, config.centerY));
    system.addInvaderForTest(makeInvader('b', 41, config.centerX, config.centerY + 10));

    const step = system.step(16, 16);

    expect(step.reachedCore).toHaveLength(2);
    expect(system.getState().gameOver).toBe(false);
    expect(system.getState().lives).toBe(Number.POSITIVE_INFINITY);
  });

  it('uses ordered multi-note progress and a -25 miss penalty in pitch mode', () => {
    const config = createArenaConfig(720, 540, 2, {
      mode: 'pitch',
    });
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.addInvaderForTest(makeInvader('target', 60, config.centerX + 100, config.centerY, 0, 0, [60, 62]));

    const progress = system.processNote(60, 100);
    const miss = system.processNote(65, 200);
    const afterResetMiss = system.processNote(62, 300);
    const progressAgain = system.processNote(60, 400);
    const hit = system.processNote(62, 500);

    expect(progress.kind).toBe('progress');
    expect(progress.scoreDelta).toBe(0);
    expect(miss.kind).toBe('miss');
    expect(miss.scoreDelta).toBe(-25);
    expect(afterResetMiss.kind).toBe('miss');
    expect(progressAgain.kind).toBe('progress');
    expect(hit.kind).toBe('hit');
    expect(system.getState().score).toBe(50);
  });

  it('chooses the nearest invader when multiple pitch candidates share the next expected note', () => {
    const config = createArenaConfig(720, 540, 2, {
      mode: 'pitch',
    });
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.addInvaderForTest(makeInvader('far', 60, config.centerX + 200, config.centerY, 0, 0, [60, 62]));
    system.addInvaderForTest(makeInvader('near', 60, config.centerX + 80, config.centerY, 0, 0, [60, 64]));

    const progress = system.processNote(60, 100);

    expect(progress.kind).toBe('progress');
    expect(progress.target?.id).toBe('near');
  });

  it('resets pitch sequence progress after the sequence window timeout', () => {
    const config = createArenaConfig(720, 540, 2, {
      mode: 'pitch',
    });
    const system = new GameStateSystem(config, () => 0.3);
    system.resetForTests(0);

    system.addInvaderForTest(makeInvader('target', 60, config.centerX + 120, config.centerY, 0, 0, [60, 62]));

    const progress = system.processNote(60, 100);
    system.step(1700, 16);
    const timedOut = system.processNote(62, 1800);

    expect(progress.kind).toBe('progress');
    expect(timedOut.kind).toBe('miss');
    expect(timedOut.scoreDelta).toBe(-25);
  });
});
