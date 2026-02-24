import type { InvaderEntity, TargetResolution } from '@/types/gameplay';

interface ResolveTargetArgs {
  invaders: InvaderEntity[];
  note: number;
  centerX: number;
  centerY: number;
}

const distanceToCenter = (invader: InvaderEntity, centerX: number, centerY: number): number =>
  Math.hypot(invader.x - centerX, invader.y - centerY);

export const compareInvaderThreat = (
  left: InvaderEntity,
  right: InvaderEntity,
  centerX: number,
  centerY: number,
): number => {
  const leftDistance = distanceToCenter(left, centerX, centerY);
  const rightDistance = distanceToCenter(right, centerX, centerY);
  if (leftDistance !== rightDistance) {
    return leftDistance - rightDistance;
  }

  return left.id.localeCompare(right.id);
};

export const resolveNearestByThreat = (
  invaders: InvaderEntity[],
  centerX: number,
  centerY: number,
): InvaderEntity | null => {
  if (invaders.length === 0) {
    return null;
  }

  return [...invaders].sort((a, b) => compareInvaderThreat(a, b, centerX, centerY))[0] ?? null;
};

export const resolveNearestThreatTarget = ({
  invaders,
  note,
  centerX,
  centerY,
}: ResolveTargetArgs): TargetResolution => {
  const match = resolveNearestByThreat(
    invaders.filter(
      (invader) =>
        (invader.targetType === 'single' || invader.targetType === 'pattern')
        && invader.note === note,
    ),
    centerX,
    centerY,
  );

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
