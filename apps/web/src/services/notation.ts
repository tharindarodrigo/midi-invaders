import { Accidental, Formatter, Renderer, Stave, StaveNote } from 'vexflow';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const STEM_DOWN_FROM_MIDI = 83; // B5

const getStemDirection = (midiNote: number): 1 | -1 => (midiNote >= STEM_DOWN_FROM_MIDI ? -1 : 1);

const midiToPitch = (midiNote: number): { letter: string; accidental: string; octave: number } => {
  const noteName = NOTE_NAMES[((midiNote % 12) + 12) % 12];
  const octave = Math.floor(midiNote / 12) - 1;
  const letter = noteName[0].toLowerCase();
  const accidental = noteName.length > 1 ? '#' : '';

  return { letter, accidental, octave };
};

export const midiToVexKey = (midiNote: number): string => {
  const { letter, accidental, octave } = midiToPitch(midiNote);
  return accidental ? `${letter}${accidental}/${octave}` : `${letter}/${octave}`;
};

export const renderStaffNoteToCanvas = (
  canvas: HTMLCanvasElement,
  midiNote: number,
  options: { clef?: 'treble' | 'bass' } = {},
): void => {
  const staffColor = '#22d3ee';
  const noteColor = '#a3e635';
  const accidentalColor = '#f472b6';

  const clef = options.clef ?? 'treble';
  const width = canvas.width;
  const height = canvas.height;
  // Keep enough left room for accidentals and enough vertical room for ledger lines.
  const insetX = 18;
  const staveY = 44;
  const staveWidth = width - insetX * 2;

  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
  const context = renderer.getContext();

  context.clearRect(0, 0, width, height);

  const stave = new Stave(insetX, staveY, staveWidth);
  stave.setContext(context);
  stave.addClef(clef);
  stave.setStyle({
    fillStyle: staffColor,
    strokeStyle: staffColor,
  });
  stave.draw();

  const vexKey = midiToVexKey(midiNote);
  const note = new StaveNote({
    keys: [vexKey],
    duration: 'q',
    clef,
    autoStem: false,
    stemDirection: getStemDirection(midiNote),
  });
  note.setStemDirection(getStemDirection(midiNote));
  note.setStyle({
    fillStyle: noteColor,
    strokeStyle: noteColor,
  });

  if (vexKey.includes('#')) {
    const accidental = new Accidental('#');
    accidental.setStyle({
      fillStyle: accidentalColor,
      strokeStyle: accidentalColor,
    });
    note.addModifier(accidental, 0);
  }

  Formatter.FormatAndDraw(context, stave, [note]);

  // Neon tint pass to guarantee clef + staff + notes remain colorful on dark backgrounds.
  const rawContext = canvas.getContext('2d');
  if (rawContext) {
    rawContext.save();
    rawContext.globalCompositeOperation = 'source-atop';
    const gradient = rawContext.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#22d3ee');
    gradient.addColorStop(0.5, '#a3e635');
    gradient.addColorStop(1, '#f472b6');
    rawContext.fillStyle = gradient;
    rawContext.fillRect(0, 0, width, height);
    rawContext.restore();
  }
};
