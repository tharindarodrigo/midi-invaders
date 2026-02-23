import type { InputNoteEvent } from '@/types/input';

const BASS_SHIFT_SEMITONES = -24;

export const KEYBOARD_NOTE_MAP: Record<string, number> = {
  // C4 octave white keys
  z: 60, // C4
  x: 62, // D4
  c: 64, // E4
  v: 65, // F4
  b: 67, // G4
  n: 69, // A4
  m: 71, // B4
  // C4 octave black keys
  s: 61, // C#4
  d: 63, // D#4
  g: 66, // F#4
  h: 68, // G#4
  j: 70, // A#4
  // C5 octave white keys
  w: 72, // C5
  e: 74, // D5
  r: 76, // E5
  t: 77, // F5
  y: 79, // G5
  u: 81, // A5
  i: 83, // B5
  // C5 octave black keys
  '3': 73, // C#5
  '4': 75, // D#5
  '6': 78, // F#5
  '7': 80, // G#5
  '8': 82, // A#5
};

export const createKeyboardFallbackHandler = (
  onNoteOn: (note: number) => void,
): ((event: KeyboardEvent) => void) => {
  return (event: KeyboardEvent) => {
    const resolved = resolveKeyboardNote(event);
    if (resolved) {
      onNoteOn(resolved.note);
    }
  };
};

const shouldIgnoreKeyEvent = (event: KeyboardEvent): boolean => {
  const element = event.target;
  if (!element) {
    return false;
  }

  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

const hasShortcutModifier = (event: KeyboardEvent): boolean => {
  return event.metaKey || event.ctrlKey || event.altKey;
};

const hasCapsLockActive = (event: KeyboardEvent): boolean => {
  return event.getModifierState('CapsLock');
};

const resolveKeyboardNote = (event: KeyboardEvent): { key: string; note: number } | null => {
  const key = event.key.toLowerCase();
  const baseNote = KEYBOARD_NOTE_MAP[key];

  if (typeof baseNote !== 'number') {
    return null;
  }

  const note = hasCapsLockActive(event) ? baseNote + BASS_SHIFT_SEMITONES : baseNote;
  return { key, note };
};

const toNoteEvent = (
  type: InputNoteEvent['type'],
  note: number,
  key: string,
  timestamp: number,
): InputNoteEvent => ({
  type,
  note,
  velocity: type === 'note_on' ? 100 : 0,
  channel: 1,
  timestamp,
  source: 'keyboard',
  inputId: 'keyboard',
  inputName: `Keyboard (${key.toUpperCase()})`,
});

export const bindKeyboardFallback = (onNoteEvent: (event: InputNoteEvent) => void): (() => void) => {
  const activeKeys = new Map<string, number>();

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || shouldIgnoreKeyEvent(event) || hasShortcutModifier(event)) {
      return;
    }

    const resolved = resolveKeyboardNote(event);
    if (!resolved) {
      return;
    }
    const { key, note } = resolved;

    event.preventDefault();

    if (activeKeys.has(key)) {
      return;
    }

    activeKeys.set(key, note);
    onNoteEvent(toNoteEvent('note_on', note, key, event.timeStamp));
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    if (shouldIgnoreKeyEvent(event)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (typeof KEYBOARD_NOTE_MAP[key] !== 'number') {
      return;
    }

    if (!hasShortcutModifier(event)) {
      event.preventDefault();
    }

    const note = activeKeys.get(key);
    if (note === undefined) {
      return;
    }

    activeKeys.delete(key);
    onNoteEvent(toNoteEvent('note_off', note, key, event.timeStamp));
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
};
