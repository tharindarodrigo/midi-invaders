import { describe, expect, it, vi } from 'vitest';
import { KEYBOARD_NOTE_MAP, bindKeyboardFallback, createKeyboardFallbackHandler } from '@/services/keyboardFallback';

const createKeyboardEvent = (
  type: 'keydown' | 'keyup',
  options: { key: string; capsLock?: boolean; metaKey?: boolean; cancelable?: boolean },
): KeyboardEvent => {
  const event = new KeyboardEvent(type, {
    key: options.key,
    metaKey: options.metaKey ?? false,
    cancelable: options.cancelable ?? false,
  });

  Object.defineProperty(event, 'getModifierState', {
    configurable: true,
    value: (modifier: string) => {
      if (modifier === 'CapsLock') {
        return options.capsLock ?? false;
      }

      return false;
    },
  });

  return event;
};

describe('keyboard fallback', () => {
  it('maps requested C4 and C5 layouts to semitones', () => {
    expect(KEYBOARD_NOTE_MAP.z).toBe(60);
    expect(KEYBOARD_NOTE_MAP.s).toBe(61);
    expect(KEYBOARD_NOTE_MAP.m).toBe(71);
    expect(KEYBOARD_NOTE_MAP.w).toBe(72);
    expect(KEYBOARD_NOTE_MAP['3']).toBe(73);
    expect(KEYBOARD_NOTE_MAP['4']).toBe(75);
    expect(KEYBOARD_NOTE_MAP['6']).toBe(78);
    expect(KEYBOARD_NOTE_MAP['7']).toBe(80);
    expect(KEYBOARD_NOTE_MAP['8']).toBe(82);
    expect(KEYBOARD_NOTE_MAP.i).toBe(83);
  });

  it('dispatches mapped notes on key press', () => {
    const onNoteOn = vi.fn();
    const handler = createKeyboardFallbackHandler(onNoteOn);

    handler(createKeyboardEvent('keydown', { key: '3' }));

    expect(onNoteOn).toHaveBeenCalledWith(73);
  });

  it('shifts keyboard notes down two octaves when CapsLock is active', () => {
    const onNoteOn = vi.fn();
    const handler = createKeyboardFallbackHandler(onNoteOn);

    handler(createKeyboardEvent('keydown', { key: 'z', capsLock: true }));

    expect(onNoteOn).toHaveBeenCalledWith(36);
  });

  it('emits note_on and note_off events when bound to window', () => {
    const onNoteEvent = vi.fn();
    const unbind = bindKeyboardFallback(onNoteEvent);

    window.dispatchEvent(createKeyboardEvent('keydown', { key: 'z' }));
    window.dispatchEvent(createKeyboardEvent('keyup', { key: 'z' }));

    expect(onNoteEvent).toHaveBeenCalledTimes(2);
    expect(onNoteEvent.mock.calls[0][0].type).toBe('note_on');
    expect(onNoteEvent.mock.calls[0][0].note).toBe(60);
    expect(onNoteEvent.mock.calls[1][0].type).toBe('note_off');

    unbind();
  });

  it('does not intercept command shortcuts like Cmd+R', () => {
    const onNoteEvent = vi.fn();
    const unbind = bindKeyboardFallback(onNoteEvent);

    const keydown = createKeyboardEvent('keydown', { key: 'r', metaKey: true, cancelable: true });
    window.dispatchEvent(keydown);

    expect(onNoteEvent).not.toHaveBeenCalled();
    expect(keydown.defaultPrevented).toBe(false);

    unbind();
  });

  it('releases an active note even if keyup includes a modifier', () => {
    const onNoteEvent = vi.fn();
    const unbind = bindKeyboardFallback(onNoteEvent);

    window.dispatchEvent(createKeyboardEvent('keydown', { key: 'z' }));
    window.dispatchEvent(createKeyboardEvent('keyup', { key: 'z', metaKey: true, cancelable: true }));

    expect(onNoteEvent).toHaveBeenCalledTimes(2);
    expect(onNoteEvent.mock.calls[1][0].type).toBe('note_off');
    expect(onNoteEvent.mock.calls[1][0].note).toBe(60);

    unbind();
  });

  it('keeps note_off pitch matched to note_on when CapsLock state changes before release', () => {
    const onNoteEvent = vi.fn();
    const unbind = bindKeyboardFallback(onNoteEvent);

    window.dispatchEvent(createKeyboardEvent('keydown', { key: 'z', capsLock: true }));
    window.dispatchEvent(createKeyboardEvent('keyup', { key: 'z', capsLock: false }));

    expect(onNoteEvent).toHaveBeenCalledTimes(2);
    expect(onNoteEvent.mock.calls[0][0].note).toBe(36);
    expect(onNoteEvent.mock.calls[1][0].type).toBe('note_off');
    expect(onNoteEvent.mock.calls[1][0].note).toBe(36);

    unbind();
  });
});
