import type { ClefMode } from '@/types/gameplay';

export type StaffClef = 'treble' | 'bass';

const TREBLE_TWO_LEDGER_MIN = 57; // A3 (two ledger lines below treble staff)
const TREBLE_TWO_LEDGER_MAX = 84; // C6 (two ledger lines above treble staff)
const BASS_TWO_LEDGER_MIN = 36; // C2 (two ledger lines below bass staff)
const BASS_TWO_LEDGER_MAX = 64; // E4 (two ledger lines above bass staff)

const createNotePool = (start: number, end: number): number[] =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

export const getNotePoolForClefMode = (clefMode: ClefMode): number[] => {
  if (clefMode === 'treble') {
    return createNotePool(TREBLE_TWO_LEDGER_MIN, TREBLE_TWO_LEDGER_MAX);
  }

  if (clefMode === 'bass') {
    return createNotePool(BASS_TWO_LEDGER_MIN, BASS_TWO_LEDGER_MAX);
  }

  return createNotePool(BASS_TWO_LEDGER_MIN, TREBLE_TWO_LEDGER_MAX);
};

const stableClefSeed = (invaderId: string): number => {
  const numericSuffix = invaderId.match(/(\d+)$/);
  if (numericSuffix) {
    return Number(numericSuffix[1]);
  }

  let hash = 0;
  for (let index = 0; index < invaderId.length; index += 1) {
    hash = (hash * 31 + invaderId.charCodeAt(index)) >>> 0;
  }

  return hash;
};

export const resolveInvaderClef = (
  clefMode: ClefMode,
  midiNote: number,
  invaderId: string,
): StaffClef => {
  if (clefMode === 'treble') {
    return 'treble';
  }

  if (clefMode === 'bass') {
    return 'bass';
  }

  if (midiNote < TREBLE_TWO_LEDGER_MIN) {
    return 'bass';
  }

  if (midiNote > BASS_TWO_LEDGER_MAX) {
    return 'treble';
  }

  // Alternate overlap notes across both clefs while staying within a two-ledger window.
  return stableClefSeed(invaderId) % 2 === 0 ? 'bass' : 'treble';
};
