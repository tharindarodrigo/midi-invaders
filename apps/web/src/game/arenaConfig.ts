import { getNotePoolForClefMode } from '@/game/notationProfile';
import {
  normalizeGameplaySettings,
  normalizeSpeedMultiplier,
} from '@/types/gameplay';
import type { ArenaConfig, DifficultyLevel, GameplaySettings } from '@/types/gameplay';

const createNotePool = (start: number, end: number): number[] =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const TREBLE_NOTE_POOL = createNotePool(60, 83); // C4..B5
const BASS_TRAINING_NOTE_POOL = createNotePool(36, 60); // C2..C4

const CORE_RADIUS = 58;
const SPAWN_RADIUS_SCALE = 0.46;
const SPEED_REFERENCE_WIDTH = 1728;
const SPEED_REFERENCE_HEIGHT = 1080;
const SPEED_REFERENCE_TRAVEL_DISTANCE = Math.max(
  1,
  Math.min(SPEED_REFERENCE_WIDTH, SPEED_REFERENCE_HEIGHT) * SPAWN_RADIUS_SCALE - CORE_RADIUS,
);

const resolveViewportSpeedScale = (spawnRadius: number): number => {
  const travelDistanceToCore = Math.max(1, spawnRadius - CORE_RADIUS);
  // Keep invader time-to-core consistent across arena sizes.
  return travelDistanceToCore / SPEED_REFERENCE_TRAVEL_DISTANCE;
};

const PITCH_PACING_BY_LEVEL: Record<
  DifficultyLevel,
  {
    speedScale: number;
    spawnIntervalScale: number;
    growthScale: number;
    promptRepeatMs: number;
    minSpawnIntervalMs: number;
  }
> = {
  1: {
    speedScale: 0.75,
    spawnIntervalScale: 1.35,
    growthScale: 0.8,
    promptRepeatMs: 2800,
    minSpawnIntervalMs: 700,
  },
  2: {
    speedScale: 0.55,
    spawnIntervalScale: 1.65,
    growthScale: 0.7,
    promptRepeatMs: 3200,
    minSpawnIntervalMs: 900,
  },
  3: {
    speedScale: 0.65,
    spawnIntervalScale: 1.45,
    growthScale: 0.75,
    promptRepeatMs: 3000,
    minSpawnIntervalMs: 800,
  },
};

const PITCH_MAX_CONCURRENT_BY_LEVEL: Record<DifficultyLevel, number> = {
  1: 1,
  2: 1,
  3: 3,
};

const ARCADE_MAX_WAVES_BY_LEVEL: Record<DifficultyLevel, number> = {
  1: 8,
  2: 10,
  3: 12,
};

export const createArenaConfig = (
  width = 720,
  height = 540,
  difficulty: DifficultyLevel = 1,
  settings?: Partial<GameplaySettings>,
): ArenaConfig => {
  const normalizedSettings = normalizeGameplaySettings({
    ...settings,
    difficulty,
  });
  const centerX = width / 2;
  const centerY = height / 2;
  const spawnRadius = Math.min(width, height) * SPAWN_RADIUS_SCALE;

  const levelPresets: Record<
    DifficultyLevel,
    Pick<
      ArenaConfig,
      'baseSpawnIntervalMs' | 'spawnIntervalDecay' | 'baseInvaderSpeed' | 'invaderSpeedGrowth' | 'baseMaxInvaders'
    > & { notePool: number[] }
  > = {
    1: {
      baseSpawnIntervalMs: 3000,
      spawnIntervalDecay: 0.994,
      baseInvaderSpeed: 20,
      invaderSpeedGrowth: 1.03,
      baseMaxInvaders: 1,
      notePool: TREBLE_NOTE_POOL,
    },
    2: {
      baseSpawnIntervalMs: 1800,
      spawnIntervalDecay: 0.978,
      baseInvaderSpeed: 24,
      invaderSpeedGrowth: 1.04,
      baseMaxInvaders: 3,
      notePool: BASS_TRAINING_NOTE_POOL,
    },
    3: {
      baseSpawnIntervalMs: 1200,
      spawnIntervalDecay: 0.95,
      baseInvaderSpeed: 40,
      invaderSpeedGrowth: 1.08,
      baseMaxInvaders: 8,
      notePool: TREBLE_NOTE_POOL,
    },
  };

  const preset = levelPresets[normalizedSettings.difficulty];
  const pitchPacing = PITCH_PACING_BY_LEVEL[normalizedSettings.difficulty];

  const isArcadeMode = normalizedSettings.mode === 'arcade';
  const isPitchMode = normalizedSettings.mode === 'pitch';
  const isPracticeMode = normalizedSettings.mode === 'practice';
  const speedMultiplier = isPracticeMode
    ? normalizeSpeedMultiplier(normalizedSettings.speedMultiplier)
    : 1;
  const pitchSpeedScale = isPitchMode ? pitchPacing.speedScale : 1;
  const pitchSpawnIntervalScale = isPitchMode ? pitchPacing.spawnIntervalScale : 1;
  const pitchGrowthScale = isPitchMode ? pitchPacing.growthScale : 1;
  const viewportSpeedScale = resolveViewportSpeedScale(spawnRadius);
  const baseInvaderSpeed =
    preset.baseInvaderSpeed
    * speedMultiplier
    * pitchSpeedScale
    * viewportSpeedScale;
  const baseSpawnIntervalMs = Math.round((preset.baseSpawnIntervalMs / speedMultiplier) * pitchSpawnIntervalScale);
  const invaderSpeedGrowth = isArcadeMode
    ? 1
    : 1 + (preset.invaderSpeedGrowth - 1) * speedMultiplier * pitchGrowthScale;
  const spawnIntervalDecay = 1 - (1 - preset.spawnIntervalDecay) * speedMultiplier * pitchGrowthScale;
  const clefMode = isPracticeMode
    ? normalizedSettings.clefMode
    : normalizedSettings.difficulty === 2
      ? 'any'
      : 'treble';
  const notePool = isPracticeMode ? getNotePoolForClefMode(clefMode) : preset.notePool;
  const infiniteLives = isPracticeMode && normalizedSettings.livesMode === 'infinite';
  const lifeUpsEnabled = !infiniteLives;
  const startingLives = infiniteLives ? Number.POSITIVE_INFINITY : 3;
  const patternLength = isPitchMode ? normalizedSettings.difficulty : 1;
  const maxConcurrentInvaders = isPitchMode
    ? PITCH_MAX_CONCURRENT_BY_LEVEL[normalizedSettings.difficulty]
    : preset.baseMaxInvaders;
  const missPenaltyPoints = isPitchMode ? 25 : 50;

  return {
    width,
    height,
    centerX,
    centerY,
    coreRadius: CORE_RADIUS,
    spawnRadius,
    notePool,
    startingLives,
    basePoints: 100,
    baseSpawnIntervalMs,
    spawnIntervalDecay,
    minSpawnIntervalMs: isPitchMode ? pitchPacing.minSpawnIntervalMs : 350,
    baseInvaderSpeed,
    invaderSpeedGrowth,
    baseMaxInvaders: preset.baseMaxInvaders,
    laserLifetimeMs: 120,
    mode: normalizedSettings.mode,
    clefMode,
    infiniteLives,
    lifeUpsEnabled,
    missPenaltyPoints,
    promptRepeatMs: isPitchMode ? pitchPacing.promptRepeatMs : 2200,
    sequenceWindowMs: 1500,
    maxConcurrentInvaders,
    patternLength,
    maxArcadeWaves: isArcadeMode ? ARCADE_MAX_WAVES_BY_LEVEL[normalizedSettings.difficulty] : null,
  };
};
