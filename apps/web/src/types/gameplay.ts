export type DifficultyLevel = 1 | 2 | 3;

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
  missCooldownMs: number;
}

export interface InvaderEntity {
  id: string;
  note: number;
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
  wave: number;
  lives: number;
  gameOver: boolean;
  hitsThisWave: number;
  weaponCooldownUntil: number;
  invaders: InvaderEntity[];
  lasers: LaserShot[];
}

export interface TargetResolution {
  matched: boolean;
  target: InvaderEntity | null;
}

export interface NoteProcessResult {
  kind: 'hit' | 'miss' | 'cooldown';
  target: InvaderEntity | null;
  laser: LaserShot | null;
  waveAdvanced: boolean;
}

export interface ArenaStepResult {
  spawned: InvaderEntity[];
  reachedCore: InvaderEntity[];
  expiredLaserIds: string[];
  gameOver: boolean;
}
