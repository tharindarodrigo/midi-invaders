import { Accidental, Formatter, Renderer, Stave, StaveNote } from 'vexflow';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const TREBLE_CENTER_LINE_MIDI = 71; // B4
const BASS_CENTER_LINE_MIDI = 50; // D3
const STAVE_HEIGHT_PX = 40;
// Optical centering inside the circular invader reads better with a slight upward shift.
const STAVE_VISUAL_OFFSET_Y_PX = -34;

export interface StaffRenderPalette {
  staffColor: string;
  noteColor: string;
  accidentalColor: string;
  gradientStart: string;
  gradientMiddle: string;
  gradientEnd: string;
}

const DEFAULT_STAFF_RENDER_PALETTE: StaffRenderPalette = {
  staffColor: '#22d3ee',
  noteColor: '#a3e635',
  accidentalColor: '#f472b6',
  gradientStart: '#22d3ee',
  gradientMiddle: '#a3e635',
  gradientEnd: '#f472b6',
};

export const getStemDirectionForMidi = (
  midiNote: number,
  clef: 'treble' | 'bass' = 'treble',
): 1 | -1 => {
  const centerLineMidi = clef === 'bass' ? BASS_CENTER_LINE_MIDI : TREBLE_CENTER_LINE_MIDI;
  return midiNote > centerLineMidi ? -1 : 1;
};

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

export const getCenteredStaveY = (canvasHeight: number): number => {
  return Math.round((canvasHeight - STAVE_HEIGHT_PX) / 2 + STAVE_VISUAL_OFFSET_Y_PX);
};

export const renderStaffNoteToCanvas = (
  canvas: HTMLCanvasElement,
  midiNote: number,
  options: { clef?: 'treble' | 'bass'; palette?: Partial<StaffRenderPalette>; insetX?: number } = {},
): void => {
  const palette = {
    ...DEFAULT_STAFF_RENDER_PALETTE,
    ...(options.palette ?? {}),
  };
  const { staffColor, noteColor, accidentalColor } = palette;

  const clef = options.clef ?? 'treble';
  const width = canvas.width;
  const height = canvas.height;
  // Keep enough left room for accidentals and enough vertical room for ledger lines.
  const insetX = options.insetX ?? 18;
  const staveY = getCenteredStaveY(height);
  const staveWidth = Math.max(84, width - insetX * 2);

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
  const stemDirection = getStemDirectionForMidi(midiNote, clef);
  const note = new StaveNote({
    keys: [vexKey],
    duration: 'q',
    clef,
    autoStem: false,
    stemDirection,
  });
  note.setStemDirection(stemDirection);
  note.setStyle({
    fillStyle: noteColor,
    strokeStyle: noteColor,
  });
  note.setLedgerLineStyle({
    fillStyle: noteColor,
    strokeStyle: noteColor,
    lineWidth: 2,
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
    gradient.addColorStop(0, palette.gradientStart);
    gradient.addColorStop(0.5, palette.gradientMiddle);
    gradient.addColorStop(1, palette.gradientEnd);
    rawContext.fillStyle = gradient;
    rawContext.fillRect(0, 0, width, height);
    rawContext.restore();
  }
};
