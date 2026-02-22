import { afterEach, describe, expect, it } from 'vitest';
import { getStoredMidiInputId, setStoredMidiInputId } from '@/services/midiPreferences';

describe('midiPreferences', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns null when there is no saved device id', () => {
    expect(getStoredMidiInputId()).toBeNull();
  });

  it('persists and returns the selected device id', () => {
    setStoredMidiInputId('device-123');

    expect(getStoredMidiInputId()).toBe('device-123');
  });

  it('removes stored id when input is cleared', () => {
    setStoredMidiInputId('device-123');
    setStoredMidiInputId(null);

    expect(getStoredMidiInputId()).toBeNull();
  });
});
