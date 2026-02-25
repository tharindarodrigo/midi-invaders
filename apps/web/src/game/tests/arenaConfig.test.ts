import { describe, expect, it } from 'vitest';
import { createArenaConfig } from '@/game/arenaConfig';
import { midiToVexKey } from '@/services/notation';

const timeToReachCoreSeconds = (
  config: ReturnType<typeof createArenaConfig>,
): number => (config.spawnRadius - config.coreRadius) / config.baseInvaderSpeed;

const hasFlatSpelling = (midiNote: number): boolean => {
  const vexKey = midiToVexKey(midiNote);
  return /^[a-g]b\//.test(vexKey);
};

describe('arena config difficulty presets', () => {
  it('builds a fixed 6-wave arcade plan and ignores difficulty selection', () => {
    const arcadeLevel1 = createArenaConfig(1728, 1080, 1, { mode: 'arcade' });
    const arcadeLevel3 = createArenaConfig(1728, 1080, 3, { mode: 'arcade' });

    expect(arcadeLevel1.arcadeWaveRules).toHaveLength(6);
    expect(arcadeLevel1.arcadeWaveRules[0]?.label).toContain('Wave 1');
    expect(arcadeLevel1.arcadeWaveRules[2]?.allowedTargets).toEqual(['chord']);
    expect(arcadeLevel1.arcadeWaveRules[4]?.allowedTargets).toEqual(['single', 'chord']);
    expect(arcadeLevel1.baseInvaderSpeed).toBe(20);
    expect(arcadeLevel1.baseMaxInvaders).toBe(1);
    expect(arcadeLevel1.baseSpawnIntervalMs).toBe(2800);
    expect(arcadeLevel1.invaderSpeedGrowth).toBe(1);
    expect(arcadeLevel1.baseInvaderSpeed).toBe(arcadeLevel3.baseInvaderSpeed);
    expect(arcadeLevel1.baseSpawnIntervalMs).toBe(arcadeLevel3.baseSpawnIntervalMs);
    expect(arcadeLevel1.baseMaxInvaders).toBe(arcadeLevel3.baseMaxInvaders);
    expect(arcadeLevel1.chordPoints).toBe(200);
    expect(arcadeLevel1.chordSimultaneousWindowMs).toBe(120);
    expect(arcadeLevel1.chordArpeggioWindowMs).toBe(900);
  });

  it('scales invader speed down on compact viewports', () => {
    const desktop = createArenaConfig(1728, 1080, 1);
    const compact = createArenaConfig(800, 1120, 1);

    expect(compact.baseInvaderSpeed).toBeLessThan(desktop.baseInvaderSpeed);
    expect(timeToReachCoreSeconds(compact)).toBeCloseTo(timeToReachCoreSeconds(desktop), 4);
  });

  it('keeps level 1 invader time-to-core consistent across screen sizes', () => {
    const reference = createArenaConfig(1728, 1080, 1);
    const referenceTime = timeToReachCoreSeconds(reference);
    const compactPortrait = createArenaConfig(800, 1120, 1);
    const compactLandscape = createArenaConfig(960, 640, 1);
    const standardDesktop = createArenaConfig(1200, 800, 1);
    const ultrawide = createArenaConfig(2304, 1384, 1);

    expect(timeToReachCoreSeconds(compactPortrait)).toBeCloseTo(referenceTime, 4);
    expect(timeToReachCoreSeconds(compactLandscape)).toBeCloseTo(referenceTime, 4);
    expect(timeToReachCoreSeconds(standardDesktop)).toBeCloseTo(referenceTime, 4);
    expect(timeToReachCoreSeconds(ultrawide)).toBeCloseTo(referenceTime, 4);
  });

  it('builds practice mode config with custom clef range, speed, and infinite lives', () => {
    const practice = createArenaConfig(1728, 1080, 2, {
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
    expect(practice.invaderSpeedGrowth).toBe(1.03);
    expect(practice.infiniteLives).toBe(true);
    expect(practice.lifeUpsEnabled).toBe(false);
    expect(practice.startingLives).toBe(Number.POSITIVE_INFINITY);
    expect(practice.arcadeWaveRules).toHaveLength(0);
  });

  it('builds pitch mode config with level-based pattern length, cap, and miss penalty', () => {
    const level1 = createArenaConfig(1728, 1080, 1, { mode: 'pitch' });
    const level2 = createArenaConfig(1728, 1080, 2, { mode: 'pitch' });
    const level3 = createArenaConfig(1728, 1080, 3, { mode: 'pitch' });
    const arcadeLevel2 = createArenaConfig(1728, 1080, 2, { mode: 'arcade' });

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
    expect(level2.invaderSpeedGrowth).toBeGreaterThan(1);
    expect(level2.arcadeWaveRules).toHaveLength(0);
  });

  it('keeps non-pitch mode penalty unchanged', () => {
    const arcade = createArenaConfig(1728, 1080, 1, { mode: 'arcade' });
    expect(arcade.missPenaltyPoints).toBe(50);
  });

  it('includes flat-spelled targets from wave 1 and through chord waves', () => {
    const arcade = createArenaConfig(1728, 1080, 1, { mode: 'arcade' });
    const wave1 = arcade.arcadeWaveRules[0];
    const wave3 = arcade.arcadeWaveRules[2];
    const wave4 = arcade.arcadeWaveRules[3];

    expect(wave1).toBeTruthy();
    expect(wave3).toBeTruthy();
    expect(wave4).toBeTruthy();

    const wave1HasFlat = (wave1?.singleNotePool ?? []).some((note) => hasFlatSpelling(note));
    const wave3ChordNotes = (wave3?.chordRootPool ?? []).flatMap((root) => [root, root + 4, root + 7]);
    const wave4ChordNotes = (wave4?.chordRootPool ?? []).flatMap((root) => [root, root + 4, root + 7]);
    const wave3HasFlat = wave3ChordNotes.some((note) => hasFlatSpelling(note));
    const wave4HasFlat = wave4ChordNotes.some((note) => hasFlatSpelling(note));

    expect(wave1HasFlat).toBe(true);
    expect(wave3HasFlat).toBe(true);
    expect(wave4HasFlat).toBe(true);
  });
});
