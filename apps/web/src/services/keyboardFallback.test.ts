import { describe, expect, it, vi } from 'vitest';
import { KEYBOARD_NOTE_MAP, bindKeyboardFallback, createKeyboardFallbackHandler } from '@/services/keyboardFallback';

describe('keyboard fallback', () => {
  it('maps requested C4 and C5 layouts to semitones', () => {
    expect(KEYBOARD_NOTE_MAP.z).toBe(60);
    expect(KEYBOARD_NOTE_MAP.s).toBe(61);
    expect(KEYBOARD_NOTE_MAP.m).toBe(71);
    expect(KEYBOARD_NOTE_MAP.w).toBe(72);
    expect(KEYBOARD_NOTE_MAP['2']).toBe(73);
    expect(KEYBOARD_NOTE_MAP.i).toBe(83);
  });

  it('dispatches mapped notes on key press', () => {
    const onNoteOn = vi.fn();
    const handler = createKeyboardFallbackHandler(onNoteOn);

    handler(new KeyboardEvent('keydown', { key: '2' }));

    expect(onNoteOn).toHaveBeenCalledWith(73);
  });

  it('emits note_on and note_off events when bound to window', () => {
    const onNoteEvent = vi.fn();
    const unbind = bindKeyboardFallback(onNoteEvent);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));

    expect(onNoteEvent).toHaveBeenCalledTimes(2);
    expect(onNoteEvent.mock.calls[0][0].type).toBe('note_on');
    expect(onNoteEvent.mock.calls[0][0].note).toBe(60);
    expect(onNoteEvent.mock.calls[1][0].type).toBe('note_off');

    unbind();
  });
});
