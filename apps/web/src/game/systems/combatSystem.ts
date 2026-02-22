import type { ArenaConfig, ArenaState, LaserShot } from '@/types/gameplay';

export const isWeaponCoolingDown = (state: ArenaState, now: number): boolean => {
  return now < state.weaponCooldownUntil;
};

export const applyMissCooldown = (state: ArenaState, config: ArenaConfig, now: number): void => {
  state.weaponCooldownUntil = Math.max(state.weaponCooldownUntil, now + config.missCooldownMs);
};

export const createLaserShot = (args: {
  id: string;
  config: Pick<ArenaConfig, 'centerX' | 'centerY' | 'laserLifetimeMs'>;
  toX: number;
  toY: number;
  now: number;
}): LaserShot => {
  return {
    id: args.id,
    fromX: args.config.centerX,
    fromY: args.config.centerY,
    toX: args.toX,
    toY: args.toY,
    createdAt: args.now,
    expiresAt: args.now + args.config.laserLifetimeMs,
  };
};
