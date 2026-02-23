import type { InvaderEntity } from '@/types/gameplay';

interface PitchProgressState {
  progressIndex: number;
  lastMatchedAt: number;
}

export interface PitchMatchResult {
  kind: 'hit' | 'progress' | 'miss';
  target: InvaderEntity | null;
}

interface MatchPitchNoteArgs {
  invaders: InvaderEntity[];
  note: number;
  now: number;
  centerX: number;
  centerY: number;
}

const sortByThreat = (
  left: InvaderEntity,
  right: InvaderEntity,
  centerX: number,
  centerY: number,
): number => {
  const leftDistance = Math.hypot(left.x - centerX, left.y - centerY);
  const rightDistance = Math.hypot(right.x - centerX, right.y - centerY);
  if (leftDistance !== rightDistance) {
    return leftDistance - rightDistance;
  }

  return left.id.localeCompare(right.id);
};

export class PitchMatcher {
  private readonly progressByInvaderId = new Map<string, PitchProgressState>();

  constructor(private readonly sequenceWindowMs: number) {}

  resetAll(invaders: InvaderEntity[]): void {
    this.syncInvaders(invaders, 0);
    for (const invader of invaders) {
      this.resetInvaderProgress(invader.id);
    }
  }

  removeInvader(invaderId: string): void {
    this.progressByInvaderId.delete(invaderId);
  }

  removeInvaders(invaderIds: string[]): void {
    for (const invaderId of invaderIds) {
      this.removeInvader(invaderId);
    }
  }

  syncInvaders(invaders: InvaderEntity[], now: number): void {
    const aliveIds = new Set(invaders.map((invader) => invader.id));

    for (const invaderId of this.progressByInvaderId.keys()) {
      if (!aliveIds.has(invaderId)) {
        this.progressByInvaderId.delete(invaderId);
      }
    }

    for (const invader of invaders) {
      const state = this.ensureProgress(invader.id);
      if (state.progressIndex <= 0) {
        continue;
      }

      if (now - state.lastMatchedAt > this.sequenceWindowMs) {
        this.resetInvaderProgress(invader.id);
      }
    }
  }

  matchNote({ invaders, note, now, centerX, centerY }: MatchPitchNoteArgs): PitchMatchResult {
    this.syncInvaders(invaders, now);

    const matches: InvaderEntity[] = [];
    for (const invader of invaders) {
      const state = this.ensureProgress(invader.id);
      const expectedNote = invader.pattern[state.progressIndex] ?? invader.note;
      if (expectedNote === note) {
        matches.push(invader);
      }
    }

    if (matches.length === 0) {
      this.resetAll(invaders);
      return {
        kind: 'miss',
        target: null,
      };
    }

    const target = matches.sort((left, right) => sortByThreat(left, right, centerX, centerY))[0];
    const state = this.ensureProgress(target.id);
    const nextProgress = state.progressIndex + 1;
    if (nextProgress >= target.pattern.length) {
      this.resetInvaderProgress(target.id);
      return {
        kind: 'hit',
        target,
      };
    }

    state.progressIndex = nextProgress;
    state.lastMatchedAt = now;
    return {
      kind: 'progress',
      target,
    };
  }

  private ensureProgress(invaderId: string): PitchProgressState {
    let state = this.progressByInvaderId.get(invaderId);
    if (!state) {
      state = {
        progressIndex: 0,
        lastMatchedAt: 0,
      };
      this.progressByInvaderId.set(invaderId, state);
    }

    return state;
  }

  private resetInvaderProgress(invaderId: string): void {
    const state = this.ensureProgress(invaderId);
    state.progressIndex = 0;
    state.lastMatchedAt = 0;
  }
}

