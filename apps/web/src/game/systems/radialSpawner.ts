import type { ArenaConfig, InvaderEntity } from '@/types/gameplay';

export const computeInvaderSpeed = (config: ArenaConfig, wave: number): number => {
  return config.baseInvaderSpeed * config.invaderSpeedGrowth ** (wave - 1);
};

export const computeSpawnIntervalMs = (config: ArenaConfig, wave: number): number => {
  const interval = config.baseSpawnIntervalMs * config.spawnIntervalDecay ** (wave - 1);
  return Math.max(config.minSpawnIntervalMs, interval);
};

export const computeMaxInvaders = (config: ArenaConfig, wave: number): number => {
  return config.baseMaxInvaders + (wave - 1);
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
  const angle = random() * Math.PI * 2;
  const x = config.centerX + Math.cos(angle) * config.spawnRadius;
  const y = config.centerY + Math.sin(angle) * config.spawnRadius;
  const speed = computeInvaderSpeed(config, wave);

  const dx = config.centerX - x;
  const dy = config.centerY - y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    id,
    note,
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
