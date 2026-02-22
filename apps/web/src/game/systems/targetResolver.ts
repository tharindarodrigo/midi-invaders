import type { InvaderEntity, TargetResolution } from '@/types/gameplay';

interface ResolveTargetArgs {
  invaders: InvaderEntity[];
  note: number;
  centerX: number;
  centerY: number;
}

const distanceToCenter = (invader: InvaderEntity, centerX: number, centerY: number): number =>
  Math.hypot(invader.x - centerX, invader.y - centerY);

export const resolveNearestThreatTarget = ({
  invaders,
  note,
  centerX,
  centerY,
}: ResolveTargetArgs): TargetResolution => {
  const match = invaders
    .filter((invader) => invader.note === note)
    .sort((a, b) => {
      const distanceDelta = distanceToCenter(a, centerX, centerY) - distanceToCenter(b, centerX, centerY);
      if (distanceDelta !== 0) {
        return distanceDelta;
      }

      return a.id.localeCompare(b.id);
    })[0];

  if (!match) {
    return {
      matched: false,
      target: null,
    };
  }

  return {
    matched: true,
    target: match,
  };
};
