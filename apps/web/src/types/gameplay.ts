export type DifficultyLevel = 1 | 2 | 3;
export type GameMode = 'arcade' | 'practice' | 'pitch';
export type ClefMode = 'treble' | 'bass' | 'any';
export type LivesMode = 'default' | 'infinite';

export interface GameplaySettings {
  difficulty: DifficultyLevel;
  mode: GameMode;
  clefMode: ClefMode;
  speedMultiplier: number;
  livesMode: LivesMode;
}

export const DEFAULT_GAMEPLAY_SETTINGS: GameplaySettings = {
  difficulty: 1,
  mode: 'arcade',
  clefMode: 'any',
  speedMultiplier: 1,
  livesMode: 'default',
};

const MIN_SPEED_MULTIPLIER = 0.6;
const MAX_SPEED_MULTIPLIER = 1.4;

const normalizeDifficultyLevel = (difficulty: number | undefined): DifficultyLevel => {
  if (difficulty === 2 || difficulty === 3) {
    return difficulty;
  }

  return 1;
};

const normalizeClefMode = (clefMode: string | undefined): ClefMode => {
  if (clefMode === 'treble' || clefMode === 'bass' || clefMode === 'any') {
    return clefMode;
  }

  return 'any';
};

const normalizeLivesMode = (livesMode: string | undefined): LivesMode => {
  if (livesMode === 'default' || livesMode === 'infinite') {
    return livesMode;
  }

  return 'default';
};

const normalizeGameMode = (mode: string | undefined): GameMode => {
  if (mode === 'arcade' || mode === 'practice' || mode === 'pitch') {
    return mode;
  }

  return 'arcade';
};

export const normalizeSpeedMultiplier = (speedMultiplier: number | undefined): number => {
  if (typeof speedMultiplier !== 'number' || !Number.isFinite(speedMultiplier)) {
    return 1;
  }

  return Math.min(MAX_SPEED_MULTIPLIER, Math.max(MIN_SPEED_MULTIPLIER, speedMultiplier));
};

export const normalizeGameplaySettings = (
  settings: Partial<GameplaySettings> | undefined,
): GameplaySettings => {
  const base = settings ?? {};

  return {
    difficulty: normalizeDifficultyLevel(base.difficulty),
    mode: normalizeGameMode(base.mode),
    clefMode: normalizeClefMode(base.clefMode),
    speedMultiplier: normalizeSpeedMultiplier(base.speedMultiplier),
    livesMode: normalizeLivesMode(base.livesMode),
  };
};

export interface ArenaConfig {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  coreRadius: number;
  spawnRadius: number;
  notePool: number[];
  startingLives: number;
  basePoints: number;
  baseSpawnIntervalMs: number;
  spawnIntervalDecay: number;
  minSpawnIntervalMs: number;
  baseInvaderSpeed: number;
  invaderSpeedGrowth: number;
  baseMaxInvaders: number;
  laserLifetimeMs: number;
  mode: GameMode;
  clefMode: ClefMode;
  infiniteLives: boolean;
  lifeUpsEnabled: boolean;
  missPenaltyPoints: number;
  promptRepeatMs: number;
  sequenceWindowMs: number;
  maxConcurrentInvaders: number;
  patternLength: number;
}

export interface InvaderEntity {
  id: string;
  note: number;
  pattern: number[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  spawnedAt: number;
}

export interface LaserShot {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  createdAt: number;
  expiresAt: number;
}

export interface ArenaState {
  score: number;
  lifeScore: number;
  wave: number;
  lives: number;
  gameOver: boolean;
  hitsThisWave: number;
  invaders: InvaderEntity[];
  lasers: LaserShot[];
}

export interface TargetResolution {
  matched: boolean;
  target: InvaderEntity | null;
}

export interface NoteProcessResult {
  kind: 'hit' | 'miss' | 'ignored' | 'progress';
  target: InvaderEntity | null;
  laser: LaserShot | null;
  waveAdvanced: boolean;
  scoreDelta: number;
  powerUp: {
    activated: boolean;
    destroyedInvaders: InvaderEntity[];
  };
}

export interface ArenaStepResult {
  spawned: InvaderEntity[];
  reachedCore: InvaderEntity[];
  expiredLaserIds: string[];
  gameOver: boolean;
}
