import { describe, expect, it } from 'vitest';
import { detectPitchFromBuffer, frequencyToMidiNote } from '@/services/microphone';

describe('frequencyToMidiNote', () => {
  it('maps common tuning frequencies to nearest MIDI notes', () => {
    expect(frequencyToMidiNote(440)).toBe(69);
    expect(frequencyToMidiNote(261.625565)).toBe(60);
    expect(frequencyToMidiNote(329.627557)).toBe(64);
  });

  it('returns null for invalid frequencies', () => {
    expect(frequencyToMidiNote(0)).toBeNull();
    expect(frequencyToMidiNote(-10)).toBeNull();
  });
});

describe('detectPitchFromBuffer', () => {
  it('detects pitch from a clean sine wave buffer', () => {
    const sampleRate = 44_100;
    const expectedFrequency = 440;
    const length = 2_048;
    const buffer = new Float32Array(length);

    for (let index = 0; index < length; index += 1) {
      buffer[index] = Math.sin((2 * Math.PI * expectedFrequency * index) / sampleRate);
    }

    const detected = detectPitchFromBuffer(buffer, sampleRate);
    expect(detected).not.toBeNull();
    expect(Math.abs((detected ?? 0) - expectedFrequency)).toBeLessThanOrEqual(2);
  });
});
