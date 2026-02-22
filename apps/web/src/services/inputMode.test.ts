import { describe, expect, it } from 'vitest';
import { canStartWithInputMode, shouldProcessInputEvent } from '@/services/inputMode';
import type { InputNoteEvent } from '@/types/input';

const midiEvent: InputNoteEvent = {
  type: 'note_on',
  note: 60,
  velocity: 100,
  channel: 1,
  timestamp: 0,
  source: 'midi',
  inputId: 'midi-1',
  inputName: 'MIDI Input',
};

const keyboardEvent: InputNoteEvent = {
  type: 'note_on',
  note: 60,
  velocity: 100,
  channel: 1,
  timestamp: 0,
  source: 'keyboard',
  inputId: 'keyboard',
  inputName: 'Keyboard',
};

describe('input mode', () => {
  it('always allows starting in keyboard mode', () => {
    expect(canStartWithInputMode('keyboard', 'idle', null)).toBe(true);
    expect(canStartWithInputMode('keyboard', 'error', null)).toBe(true);
  });

  it('requires connected MIDI input when midi mode is selected', () => {
    expect(canStartWithInputMode('midi', 'ready', 'midi-1')).toBe(true);
    expect(canStartWithInputMode('midi', 'ready', null)).toBe(false);
    expect(canStartWithInputMode('midi', 'idle', 'midi-1')).toBe(false);
  });

  it('processes only events from the selected input mode', () => {
    expect(shouldProcessInputEvent('keyboard', null, keyboardEvent)).toBe(true);
    expect(shouldProcessInputEvent('keyboard', null, midiEvent)).toBe(false);
    expect(shouldProcessInputEvent('midi', 'midi-1', midiEvent)).toBe(true);
    expect(shouldProcessInputEvent('midi', 'midi-1', keyboardEvent)).toBe(false);
  });
});
