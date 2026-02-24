import type { ArenaConfig, InvaderEntity } from '@/types/gameplay';

export const computeInvaderSpeed = (config: ArenaConfig, wave: number): number => {
  return config.baseInvaderSpeed * config.invaderSpeedGrowth ** (wave - 1);
};

export const computeSpawnIntervalMs = (config: ArenaConfig, wave: number): number => {
  const interval = config.baseSpawnIntervalMs * config.spawnIntervalDecay ** (wave - 1);
  return Math.max(config.minSpawnIntervalMs, interval);
};

export const computeMaxInvaders = (config: ArenaConfig, wave: number): number => {
  if (config.mode === 'pitch') {
    return config.maxConcurrentInvaders;
  }

  return config.baseMaxInvaders + (wave - 1);
};

const pickBorderSpawnPoint = (
  width: number,
  height: number,
  random: () => number,
): { x: number; y: number } => {
  const perimeter = 2 * (width + height);
  let offset = random() * perimeter;

  if (offset < width) {
    return { x: offset, y: 0 };
  }
  offset -= width;

  if (offset < height) {
    return { x: width, y: offset };
  }
  offset -= height;

  if (offset < width) {
    return { x: width - offset, y: height };
  }

  return { x: 0, y: height - (offset - width) };
};

interface BuildInvaderArgs {
  config: ArenaConfig;
  id: string;
  note: number;
  wave: number;
  now: number;
  random: () => number;
}

export const buildRadialInvader = ({
  config,
  id,
  note,
  wave,
  now,
  random,
}: BuildInvaderArgs): InvaderEntity => {
  const { x, y } = pickBorderSpawnPoint(config.width, config.height, random);
  const speed = computeInvaderSpeed(config, wave);

  const dx = config.centerX - x;
  const dy = config.centerY - y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    id,
    note,
    pattern: [note],
    x,
    y,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    speed,
    spawnedAt: now,
  };
};

export const distanceToCore = (invader: Pick<InvaderEntity, 'x' | 'y'>, config: Pick<ArenaConfig, 'centerX' | 'centerY'>): number => {
  return Math.hypot(invader.x - config.centerX, invader.y - config.centerY);
};
