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
  const spawnRadius = Math.min(width, height) * 0.46;

  const levelPresets: Record<
    DifficultyLevel,
    Pick<
      ArenaConfig,
      'baseSpawnIntervalMs' | 'spawnIntervalDecay' | 'baseInvaderSpeed' | 'invaderSpeedGrowth' | 'baseMaxInvaders'
    > & { notePool: number[] }
  > = {
    1: {
      baseSpawnIntervalMs: 2100,
      spawnIntervalDecay: 0.985,
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

  const isPracticeMode = normalizedSettings.mode === 'practice';
  const speedMultiplier = isPracticeMode
    ? normalizeSpeedMultiplier(normalizedSettings.speedMultiplier)
    : 1;
  const baseInvaderSpeed = preset.baseInvaderSpeed * speedMultiplier;
  const baseSpawnIntervalMs = Math.round(preset.baseSpawnIntervalMs / speedMultiplier);
  const invaderSpeedGrowth = 1 + (preset.invaderSpeedGrowth - 1) * speedMultiplier;
  const spawnIntervalDecay = 1 - (1 - preset.spawnIntervalDecay) * speedMultiplier;
  const clefMode = isPracticeMode
    ? normalizedSettings.clefMode
    : normalizedSettings.difficulty === 2
      ? 'any'
      : 'treble';
  const notePool = isPracticeMode ? getNotePoolForClefMode(clefMode) : preset.notePool;
  const infiniteLives = isPracticeMode && normalizedSettings.livesMode === 'infinite';
  const lifeUpsEnabled = !infiniteLives;
  const startingLives = infiniteLives ? Number.POSITIVE_INFINITY : 3;

  return {
    width,
    height,
    centerX,
    centerY,
    coreRadius: 58,
    spawnRadius,
    notePool,
    startingLives,
    basePoints: 100,
    baseSpawnIntervalMs,
    spawnIntervalDecay,
    minSpawnIntervalMs: 350,
    baseInvaderSpeed,
    invaderSpeedGrowth,
    baseMaxInvaders: preset.baseMaxInvaders,
    laserLifetimeMs: 120,
    mode: normalizedSettings.mode,
    clefMode,
    infiniteLives,
    lifeUpsEnabled,
  };
};
