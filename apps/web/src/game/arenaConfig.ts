import type { ArenaConfig, DifficultyLevel } from '@/types/gameplay';

const NOTE_POOL_START = 60; // C4
const NOTE_POOL_END = 83; // B5
const NOTE_POOL = Array.from(
  { length: NOTE_POOL_END - NOTE_POOL_START + 1 },
  (_, index) => NOTE_POOL_START + index,
);

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
      baseMaxInvaders: 1,
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
    notePool: NOTE_POOL,
    startingLives: 3,
    basePoints: 100,
    baseSpawnIntervalMs: preset.baseSpawnIntervalMs,
    spawnIntervalDecay: preset.spawnIntervalDecay,
    minSpawnIntervalMs: 350,
    baseInvaderSpeed: preset.baseInvaderSpeed,
    invaderSpeedGrowth: preset.invaderSpeedGrowth,
    baseMaxInvaders: preset.baseMaxInvaders,
    laserLifetimeMs: 120,
  };
};
