import { describe, expect, it, vi } from 'vitest';
import { KEYBOARD_NOTE_MAP, bindKeyboardFallback, createKeyboardFallbackHandler } from '@/services/keyboardFallback';

describe('keyboard fallback', () => {
  it('maps common key layout to an octave', () => {
    expect(KEYBOARD_NOTE_MAP.a).toBe(60);
    expect(KEYBOARD_NOTE_MAP.j).toBe(71);
  });

  it('dispatches mapped notes on key press', () => {
    const onNoteOn = vi.fn();
    const handler = createKeyboardFallbackHandler(onNoteOn);

    handler(new KeyboardEvent('keydown', { key: 'd' }));

    expect(onNoteOn).toHaveBeenCalledWith(64);
  });

  it('emits note_on and note_off events when bound to window', () => {
    const onNoteEvent = vi.fn();
    const unbind = bindKeyboardFallback(onNoteEvent);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));

    expect(onNoteEvent).toHaveBeenCalledTimes(2);
    expect(onNoteEvent.mock.calls[0][0].type).toBe('note_on');
    expect(onNoteEvent.mock.calls[0][0].note).toBe(60);
    expect(onNoteEvent.mock.calls[1][0].type).toBe('note_off');

    unbind();
  });
});
