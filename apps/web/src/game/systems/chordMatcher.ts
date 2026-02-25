import type { InvaderEntity } from '@/types/gameplay';
import { resolveNearestByThreat } from '@/game/systems/targetResolver';

interface BufferedNoteOn {
  note: number;
  at: number;
}

interface MatchChordArgs {
  invaders: InvaderEntity[];
  note: number;
  now: number;
  centerX: number;
  centerY: number;
  noteToleranceSemitones?: number;
  arpeggioWindowMs?: number;
}

export interface ChordMatchResult {
  kind: 'hit' | 'progress' | 'miss';
  target: InvaderEntity | null;
}

const uniqueAscending = (notes: number[]): number[] =>
  [...new Set(notes)].sort((left, right) => left - right);

const isNoteMatch = (detectedNote: number, requiredNote: number, toleranceSemitones: number): boolean =>
  Math.abs(detectedNote - requiredNote) <= toleranceSemitones;

const matchesSimultaneousWindow = (
  requiredNotes: number[],
  recentNotes: BufferedNoteOn[],
  now: number,
  simultaneousWindowMs: number,
  noteToleranceSemitones: number,
): boolean => {
  if (requiredNotes.length < 3) {
    return false;
  }

  const notesInWindow = new Set(
    recentNotes
      .filter((event) => now - event.at <= simultaneousWindowMs)
      .map((event) => event.note),
  );

  if (notesInWindow.size < requiredNotes.length) {
    return false;
  }

  const detectedNotes = [...notesInWindow];
  return requiredNotes.every((required) =>
    detectedNotes.some((detected) => isNoteMatch(detected, required, noteToleranceSemitones)));
};

const matchesAscendingArpeggio = (
  requiredNotes: number[],
  recentNotes: BufferedNoteOn[],
  noteToleranceSemitones: number,
): boolean => {
  if (requiredNotes.length < 3) {
    return false;
  }

  let nextRequiredIndex = 0;
  for (const event of recentNotes) {
    const nextRequired = requiredNotes[nextRequiredIndex];
    if (!isNoteMatch(event.note, nextRequired, noteToleranceSemitones)) {
      continue;
    }

    nextRequiredIndex += 1;
    if (nextRequiredIndex >= requiredNotes.length) {
      return true;
    }
  }

  return false;
};

export class ChordMatcher {
  private readonly recentNoteOns: BufferedNoteOn[] = [];

  constructor(
    private readonly simultaneousWindowMs: number,
    private readonly arpeggioWindowMs: number,
  ) {}

  reset(): void {
    this.recentNoteOns.length = 0;
  }

  matchChord({
    invaders,
    note,
    now,
    centerX,
    centerY,
    noteToleranceSemitones = 0,
    arpeggioWindowMs,
  }: MatchChordArgs): ChordMatchResult {
    this.appendNote(note, now, arpeggioWindowMs ?? this.arpeggioWindowMs);

    const chordInvaders = invaders.filter(
      (invader) => invader.targetType === 'chord' && invader.requiredNotes.length >= 3,
    );
    if (chordInvaders.length === 0) {
      return { kind: 'miss', target: null };
    }

    const hitCandidates: InvaderEntity[] = [];
    const progressCandidates: InvaderEntity[] = [];

    for (const invader of chordInvaders) {
      const requiredNotes = uniqueAscending(invader.requiredNotes);
      const hitBySimultaneous = matchesSimultaneousWindow(
        requiredNotes,
        this.recentNoteOns,
        now,
        this.simultaneousWindowMs,
        noteToleranceSemitones,
      );
      const hitByArpeggio = matchesAscendingArpeggio(
        requiredNotes,
        this.recentNoteOns,
        noteToleranceSemitones,
      );
      if (hitBySimultaneous || hitByArpeggio) {
        hitCandidates.push(invader);
        continue;
      }

      if (requiredNotes.some((required) => isNoteMatch(note, required, noteToleranceSemitones))) {
        progressCandidates.push(invader);
      }
    }

    const hitTarget = resolveNearestByThreat(hitCandidates, centerX, centerY);
    if (hitTarget) {
      this.reset();
      return {
        kind: 'hit',
        target: hitTarget,
      };
    }

    const progressTarget = resolveNearestByThreat(progressCandidates, centerX, centerY);
    if (progressTarget) {
      return {
        kind: 'progress',
        target: progressTarget,
      };
    }

    return {
      kind: 'miss',
      target: null,
    };
  }

  private appendNote(note: number, now: number, arpeggioWindowMs: number): void {
    this.recentNoteOns.push({ note, at: now });
    const minTimestamp = now - arpeggioWindowMs;
    while (this.recentNoteOns.length > 0 && this.recentNoteOns[0].at < minTimestamp) {
      this.recentNoteOns.shift();
    }
  }
}
