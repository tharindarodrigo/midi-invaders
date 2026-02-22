import type { ArenaConfig, DifficultyLevel } from '@/types/gameplay';

export const createArenaConfig = (
  width = 720,
  height = 540,
  difficulty: DifficultyLevel = 1,
): ArenaConfig => {
  const centerX = width / 2;
  const centerY = height / 2;
  const spawnRadius = Math.min(width, height) * 0.46;

  const levelPresets: Record<DifficultyLevel, Pick<ArenaConfig, 'baseSpawnIntervalMs' | 'spawnIntervalDecay' | 'baseInvaderSpeed' | 'invaderSpeedGrowth' | 'baseMaxInvaders'>> = {
    1: {
      baseSpawnIntervalMs: 2100,
      spawnIntervalDecay: 0.985,
      baseInvaderSpeed: 20,
      invaderSpeedGrowth: 1.03,
      baseMaxInvaders: 4,
    },
    2: {
      baseSpawnIntervalMs: 1550,
      spawnIntervalDecay: 0.97,
      baseInvaderSpeed: 30,
      invaderSpeedGrowth: 1.05,
      baseMaxInvaders: 6,
    },
    3: {
      baseSpawnIntervalMs: 1200,
      spawnIntervalDecay: 0.95,
      baseInvaderSpeed: 40,
      invaderSpeedGrowth: 1.08,
      baseMaxInvaders: 8,
    },
  };

  const preset = levelPresets[difficulty];

  return {
    width,
    height,
    centerX,
    centerY,
    coreRadius: 58,
    spawnRadius,
    notePool: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71],
    startingLives: 3,
    basePoints: 100,
    baseSpawnIntervalMs: preset.baseSpawnIntervalMs,
    spawnIntervalDecay: preset.spawnIntervalDecay,
    minSpawnIntervalMs: 350,
    baseInvaderSpeed: preset.baseInvaderSpeed,
    invaderSpeedGrowth: preset.invaderSpeedGrowth,
    baseMaxInvaders: preset.baseMaxInvaders,
    laserLifetimeMs: 120,
    missCooldownMs: 350,
  };
};
