import type { ArenaConfig, LaserShot } from '@/types/gameplay';

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
