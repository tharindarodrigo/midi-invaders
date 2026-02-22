import { describe, expect, it, vi } from 'vitest';
import { parseMidiMessage, supportsWebMidi } from '@/services/midi';

describe('supportsWebMidi', () => {
  it('returns false when requestMIDIAccess is absent', () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'requestMIDIAccess');
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      value: undefined,
      configurable: true,
    });

    expect(supportsWebMidi()).toBe(false);

    if (descriptor) {
      Object.defineProperty(navigator, 'requestMIDIAccess', descriptor);
    }
  });

  it('returns true when requestMIDIAccess exists', () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      value: vi.fn(),
      configurable: true,
    });

    expect(supportsWebMidi()).toBe(true);
  });
});

describe('parseMidiMessage', () => {
  it('parses note on messages', () => {
    const parsed = parseMidiMessage(new Uint8Array([0x90, 60, 100]));

    expect(parsed).toEqual({
      type: 'note_on',
      note: 60,
      velocity: 100,
      channel: 1,
    });
  });

  it('parses note off messages', () => {
    const parsed = parseMidiMessage(new Uint8Array([0x80, 60, 0]));

    expect(parsed).toEqual({
      type: 'note_off',
      note: 60,
      velocity: 0,
      channel: 1,
    });
  });

  it('treats NoteOn velocity 0 as NoteOff', () => {
    const parsed = parseMidiMessage(new Uint8Array([0x90, 64, 0]));

    expect(parsed?.type).toBe('note_off');
  });

  it('ignores non-note messages', () => {
    const parsed = parseMidiMessage(new Uint8Array([0xb0, 64, 127]));

    expect(parsed).toBeNull();
  });
});
