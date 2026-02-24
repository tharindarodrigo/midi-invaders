import { describe, expect, it } from 'vitest';
import {
  canStartWithInputMode,
  resolvePreferredInputMode,
  shouldProcessInputEvent,
} from '@/services/inputMode';
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

const microphoneEvent: InputNoteEvent = {
  type: 'note_on',
  note: 64,
  velocity: 100,
  channel: 1,
  timestamp: 0,
  source: 'microphone',
  inputId: 'microphone',
  inputName: 'Microphone',
};

describe('input mode', () => {
  it('prefers microphone mode on mobile when microphone input is supported', () => {
    expect(resolvePreferredInputMode(true, true)).toBe('microphone');
  });

  it('falls back to keyboard mode on mobile when microphone input is unavailable', () => {
    expect(resolvePreferredInputMode(true, false)).toBe('keyboard');
  });

  it('defaults to keyboard mode for non-mobile viewports', () => {
    expect(resolvePreferredInputMode(false, true)).toBe('keyboard');
    expect(resolvePreferredInputMode(false, false)).toBe('keyboard');
  });

  it('always allows starting in keyboard mode', () => {
    expect(canStartWithInputMode('keyboard', 'idle', null, 'idle')).toBe(true);
    expect(canStartWithInputMode('keyboard', 'error', null, 'error')).toBe(true);
  });

  it('requires connected MIDI input when midi mode is selected', () => {
    expect(canStartWithInputMode('midi', 'ready', 'midi-1', 'idle')).toBe(true);
    expect(canStartWithInputMode('midi', 'ready', null, 'idle')).toBe(false);
    expect(canStartWithInputMode('midi', 'idle', 'midi-1', 'idle')).toBe(false);
  });

  it('requires connected microphone when microphone mode is selected', () => {
    expect(canStartWithInputMode('microphone', 'idle', null, 'ready')).toBe(true);
    expect(canStartWithInputMode('microphone', 'ready', 'midi-1', 'idle')).toBe(false);
  });

  it('processes only events from the selected input mode', () => {
    expect(shouldProcessInputEvent('keyboard', null, keyboardEvent)).toBe(true);
    expect(shouldProcessInputEvent('keyboard', null, midiEvent)).toBe(false);
    expect(shouldProcessInputEvent('keyboard', null, microphoneEvent)).toBe(false);
    expect(shouldProcessInputEvent('midi', 'midi-1', midiEvent)).toBe(true);
    expect(shouldProcessInputEvent('midi', 'midi-1', keyboardEvent)).toBe(false);
    expect(shouldProcessInputEvent('microphone', null, microphoneEvent)).toBe(true);
    expect(shouldProcessInputEvent('microphone', null, midiEvent)).toBe(false);
  });
});
