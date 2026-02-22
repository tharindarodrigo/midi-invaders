const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const noteNumberToName = (note: number): string => {
  if (!Number.isInteger(note) || note < 0 || note > 127) {
    return 'Unknown';
  }

  const octave = Math.floor(note / 12) - 1;
  const noteName = NOTE_NAMES[note % 12];
  return `${noteName}${octave}`;
};
