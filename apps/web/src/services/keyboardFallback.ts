import type { InputNoteEvent } from '@/types/input';

export const KEYBOARD_NOTE_MAP: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
};

export const createKeyboardFallbackHandler = (
  onNoteOn: (note: number) => void,
): ((event: KeyboardEvent) => void) => {
  return (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const note = KEYBOARD_NOTE_MAP[key];

    if (typeof note === 'number') {
      onNoteOn(note);
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
  const activeKeys = new Set<string>();

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || shouldIgnoreKeyEvent(event)) {
      return;
    }

    const key = event.key.toLowerCase();
    const note = KEYBOARD_NOTE_MAP[key];

    if (typeof note !== 'number') {
      return;
    }

    if (activeKeys.has(key)) {
      return;
    }

    activeKeys.add(key);
    onNoteEvent(toNoteEvent('note_on', note, key, event.timeStamp));
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    const note = KEYBOARD_NOTE_MAP[key];

    if (typeof note !== 'number') {
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
