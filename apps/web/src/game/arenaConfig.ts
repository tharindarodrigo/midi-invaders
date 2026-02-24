import { getNotePoolForClefMode } from '@/game/notationProfile';
import {
  normalizeGameplaySettings,
  normalizeSpeedMultiplier,
} from '@/types/gameplay';
import type {
  ArcadeWaveRule,
  ArenaConfig,
  DifficultyLevel,
  GameplaySettings,
} from '@/types/gameplay';

const createNotePool = (start: number, end: number): number[] =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const TREBLE_NOTE_POOL = createNotePool(60, 83); // C4..B5
const BASS_TRAINING_NOTE_POOL = createNotePool(36, 60); // C2..C4
const TREBLE_SINGLE_WAVE_POOL = createNotePool(60, 72); // C4..C5
const MIXED_SINGLE_WAVE_POOL = createNotePool(48, 72); // C3..C5
const TREBLE_CHORD_ROOT_POOL = [60, 62, 64, 65, 67, 69]; // C4..A4
const BASS_CHORD_ROOT_POOL = [36, 38, 40, 41, 43, 45]; // C2..A2
const MIXED_CHORD_ROOT_POOL = [48, 50, 52, 53, 55, 57, 60, 62];

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

const ARCADE_WAVE_RULES: ArcadeWaveRule[] = [
  {
    label: 'Wave 1: Treble Singles',
    clefMode: 'treble',
    singleNotePool: TREBLE_SINGLE_WAVE_POOL,
    chordRootPool: [],
    allowedTargets: ['single'],
    chordChance: 0,
    baseSpawnIntervalMs: 2800,
    minSpawnIntervalMs: 1900,
    baseInvaderSpeed: 20,
    baseMaxInvaders: 1,
    speedRampWithinWave: 0.04,
  },
  {
    label: 'Wave 2: Treble + Bass Singles',
    clefMode: 'any',
    singleNotePool: MIXED_SINGLE_WAVE_POOL,
    chordRootPool: [],
    allowedTargets: ['single'],
    chordChance: 0,
    baseSpawnIntervalMs: 2400,
    minSpawnIntervalMs: 1700,
    baseInvaderSpeed: 20,
    baseMaxInvaders: 2,
    speedRampWithinWave: 0.045,
  },
  {
    label: 'Wave 3: Treble Major Chords',
    clefMode: 'treble',
    singleNotePool: TREBLE_SINGLE_WAVE_POOL,
    chordRootPool: TREBLE_CHORD_ROOT_POOL,
    allowedTargets: ['chord'],
    chordChance: 1,
    baseSpawnIntervalMs: 2500,
    minSpawnIntervalMs: 1750,
    baseInvaderSpeed: 20,
    baseMaxInvaders: 2,
    speedRampWithinWave: 0.04,
  },
  {
    label: 'Wave 4: Bass Major Chords',
    clefMode: 'bass',
    singleNotePool: BASS_TRAINING_NOTE_POOL,
    chordRootPool: BASS_CHORD_ROOT_POOL,
    allowedTargets: ['chord'],
    chordChance: 1,
    baseSpawnIntervalMs: 2500,
    minSpawnIntervalMs: 1750,
    baseInvaderSpeed: 20,
    baseMaxInvaders: 2,
    speedRampWithinWave: 0.04,
  },
  {
    label: 'Wave 5: Mixed Singles + Chords',
    clefMode: 'any',
    singleNotePool: MIXED_SINGLE_WAVE_POOL,
    chordRootPool: MIXED_CHORD_ROOT_POOL,
    allowedTargets: ['single', 'chord'],
    chordChance: 0.35,
    baseSpawnIntervalMs: 2200,
    minSpawnIntervalMs: 1500,
    baseInvaderSpeed: 20,
    baseMaxInvaders: 3,
    speedRampWithinWave: 0.05,
  },
  {
    label: 'Wave 6: Mixed Pressure',
    clefMode: 'any',
    singleNotePool: createNotePool(43, 74),
    chordRootPool: [45, 47, 48, 50, 52, 53, 55, 57, 59, 60],
    allowedTargets: ['single', 'chord'],
    chordChance: 0.45,
    baseSpawnIntervalMs: 2000,
    minSpawnIntervalMs: 1300,
    baseInvaderSpeed: 20,
    baseMaxInvaders: 4,
    speedRampWithinWave: 0.06,
  },
];

export const getArcadeWaveLoop = (wave: number, waveCount: number): number => {
  if (waveCount <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor((wave - 1) / waveCount));
};

export const getArcadeWaveRuleIndex = (wave: number, waveCount: number): number => {
  if (waveCount <= 0) {
    return 0;
  }

  return ((Math.max(1, wave) - 1) % waveCount + waveCount) % waveCount;
};

export const getArcadeWaveRuleForWave = (
  config: Pick<ArenaConfig, 'arcadeWaveRules'>,
  wave: number,
): ArcadeWaveRule | null => {
  if (config.arcadeWaveRules.length === 0) {
    return null;
  }

  return config.arcadeWaveRules[getArcadeWaveRuleIndex(wave, config.arcadeWaveRules.length)] ?? null;
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

  const isArcadeMode = normalizedSettings.mode === 'arcade';
  const effectiveDifficulty: DifficultyLevel = isArcadeMode ? 1 : normalizedSettings.difficulty;

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

  const preset = levelPresets[effectiveDifficulty];
  const pitchPacing = PITCH_PACING_BY_LEVEL[effectiveDifficulty];
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
  const clefMode = isArcadeMode
    ? 'any'
    : isPracticeMode
      ? normalizedSettings.clefMode
      : effectiveDifficulty === 2
        ? 'any'
        : 'treble';
  const notePool = isPracticeMode ? getNotePoolForClefMode(clefMode) : preset.notePool;
  const infiniteLives = isPracticeMode && normalizedSettings.livesMode === 'infinite';
  const lifeUpsEnabled = !infiniteLives;
  const startingLives = infiniteLives ? Number.POSITIVE_INFINITY : 3;
  const patternLength = isPitchMode ? effectiveDifficulty : 1;
  const maxConcurrentInvaders = isPitchMode
    ? PITCH_MAX_CONCURRENT_BY_LEVEL[effectiveDifficulty]
    : preset.baseMaxInvaders;
  const missPenaltyPoints = isPitchMode ? 25 : 50;

  const arcadeWaveRules = isArcadeMode
    ? ARCADE_WAVE_RULES.map((rule) => ({
      ...rule,
      singleNotePool: [...rule.singleNotePool],
      chordRootPool: [...rule.chordRootPool],
      baseInvaderSpeed: rule.baseInvaderSpeed * viewportSpeedScale,
    }))
    : [];

  const arcadeWave1 = arcadeWaveRules[0];

  return {
    width,
    height,
    centerX,
    centerY,
    coreRadius: CORE_RADIUS,
    spawnRadius,
    notePool: arcadeWave1 ? [...arcadeWave1.singleNotePool] : notePool,
    startingLives,
    basePoints: 100,
    chordPoints: 200,
    baseSpawnIntervalMs: arcadeWave1 ? arcadeWave1.baseSpawnIntervalMs : baseSpawnIntervalMs,
    spawnIntervalDecay,
    minSpawnIntervalMs: arcadeWave1 ? arcadeWave1.minSpawnIntervalMs : isPitchMode ? pitchPacing.minSpawnIntervalMs : 350,
    baseInvaderSpeed: arcadeWave1 ? arcadeWave1.baseInvaderSpeed : baseInvaderSpeed,
    invaderSpeedGrowth,
    baseMaxInvaders: arcadeWave1 ? arcadeWave1.baseMaxInvaders : preset.baseMaxInvaders,
    chordSimultaneousWindowMs: 120,
    chordArpeggioWindowMs: 900,
    arcadeWaveRules,
    arcadeLoopSpawnIntervalScale: 0.96,
    arcadeLoopMaxInvaderIncrease: 1,
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
  };
};
