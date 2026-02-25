// Mixed enharmonic spelling keeps both sharps and flats in gameplay notation.
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export const getPitchClassNoteName = (pitchClass: number): (typeof NOTE_NAMES)[number] => {
  const normalizedPitchClass = ((pitchClass % 12) + 12) % 12;
  return NOTE_NAMES[normalizedPitchClass] ?? 'C';
};

export const noteNumberToName = (note: number): string => {
  if (!Number.isInteger(note) || note < 0 || note > 127) {
    return 'Unknown';
  }

  const octave = Math.floor(note / 12) - 1;
  const noteName = getPitchClassNoteName(note);
  return `${noteName}${octave}`;
};
