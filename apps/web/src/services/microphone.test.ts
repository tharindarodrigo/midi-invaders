import { describe, expect, it } from 'vitest';
import {
  confirmStableMidiNote,
  createPitchStabilityState,
  detectPitchFromBuffer,
  frequencyToMidiNote,
} from '@/services/microphone';

const SAMPLE_RATE = 44_100;
const BUFFER_LENGTH = 2_048;

const createSineWaveBuffer = (frequency: number, amplitude = 1): Float32Array => {
  const buffer = new Float32Array(BUFFER_LENGTH);
  for (let index = 0; index < BUFFER_LENGTH; index += 1) {
    buffer[index] = amplitude * Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE);
  }
  return buffer;
};

const createDeterministicNoiseBuffer = (amplitude = 1, seed = 123_456_789): Float32Array => {
  const buffer = new Float32Array(BUFFER_LENGTH);
  let state = seed >>> 0;

  for (let index = 0; index < BUFFER_LENGTH; index += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    const noiseSample = (state / 0xffffffff) * 2 - 1;
    buffer[index] = noiseSample * amplitude;
  }

  return buffer;
};

describe('frequencyToMidiNote', () => {
  it('maps common tuning frequencies to nearest MIDI notes', () => {
    expect(frequencyToMidiNote(440)).toBe(69);
    expect(frequencyToMidiNote(261.625565)).toBe(60);
    expect(frequencyToMidiNote(329.627557)).toBe(64);
  });

  it('maps edge piano frequencies to the expected MIDI notes', () => {
    expect(frequencyToMidiNote(27.5)).toBe(21); // A0
    expect(frequencyToMidiNote(4186.009)).toBe(108); // C8
  });

  it('returns null for invalid frequencies', () => {
    expect(frequencyToMidiNote(0)).toBeNull();
    expect(frequencyToMidiNote(-10)).toBeNull();
  });

  it('returns null for frequencies outside the MIDI note range', () => {
    expect(frequencyToMidiNote(1)).toBeNull();
    expect(frequencyToMidiNote(30_000)).toBeNull();
  });
});

describe('detectPitchFromBuffer', () => {
  it('detects pitch from a clean sine wave buffer', () => {
    const expectedFrequency = 440;
    const buffer = createSineWaveBuffer(expectedFrequency);

    const detected = detectPitchFromBuffer(buffer, SAMPLE_RATE);
    expect(detected).not.toBeNull();
    expect(Math.abs((detected ?? 0) - expectedFrequency)).toBeLessThanOrEqual(2);
  });

  it('returns null for a completely silent buffer', () => {
    const buffer = new Float32Array(BUFFER_LENGTH);
    expect(detectPitchFromBuffer(buffer, SAMPLE_RATE)).toBeNull();
  });

  it('returns null for a low-amplitude buffer below RMS threshold', () => {
    const buffer = createSineWaveBuffer(440, 0.001);
    expect(detectPitchFromBuffer(buffer, SAMPLE_RATE)).toBeNull();
  });

  it('detects the dominant pitch in a multi-frequency signal', () => {
    const dominantFrequency = 440;
    const secondaryFrequency = 660;
    const buffer = new Float32Array(BUFFER_LENGTH);

    for (let index = 0; index < BUFFER_LENGTH; index += 1) {
      const t = index / SAMPLE_RATE;
      buffer[index] =
        0.6 * Math.sin(2 * Math.PI * dominantFrequency * t) +
        0.3 * Math.sin(2 * Math.PI * secondaryFrequency * t);
    }

    const detected = detectPitchFromBuffer(buffer, SAMPLE_RATE);
    expect(detected).not.toBeNull();
    expect(Math.abs((detected ?? 0) - dominantFrequency)).toBeLessThanOrEqual(8);
  });

  it('returns null for noise-like signals with no clear periodicity', () => {
    const buffer = createDeterministicNoiseBuffer(0.8);
    expect(detectPitchFromBuffer(buffer, SAMPLE_RATE)).toBeNull();
  });

  it('returns null for a flat high-RMS signal with no usable dip or peak', () => {
    const buffer = new Float32Array(BUFFER_LENGTH);
    buffer.fill(0.4);
    expect(detectPitchFromBuffer(buffer, SAMPLE_RATE)).toBeNull();
  });
});

describe('confirmStableMidiNote', () => {
  it('only confirms a note after enough consecutive frames', () => {
    const state = createPitchStabilityState();

    expect(confirmStableMidiNote(state, 60, 3)).toBeNull();
    expect(confirmStableMidiNote(state, 60, 3)).toBeNull();
    expect(confirmStableMidiNote(state, 60, 3)).toBe(60);
  });

  it('ignores single-frame fluctuations before confirming a note', () => {
    const state = createPitchStabilityState();

    expect(confirmStableMidiNote(state, 60, 3)).toBeNull();
    expect(confirmStableMidiNote(state, 61, 3)).toBeNull();
    expect(confirmStableMidiNote(state, 60, 3)).toBeNull();
    expect(confirmStableMidiNote(state, 60, 3)).toBeNull();
    expect(confirmStableMidiNote(state, 60, 3)).toBe(60);
  });

  it('resets stability tracking when pitch disappears', () => {
    const state = createPitchStabilityState();

    expect(confirmStableMidiNote(state, 64, 3)).toBeNull();
    expect(confirmStableMidiNote(state, 64, 3)).toBeNull();
    expect(confirmStableMidiNote(state, null, 3)).toBeNull();
    expect(confirmStableMidiNote(state, 64, 3)).toBeNull();
    expect(confirmStableMidiNote(state, 64, 3)).toBeNull();
    expect(confirmStableMidiNote(state, 64, 3)).toBe(64);
  });

  it('treats neighboring semitones as stable when tolerance is provided', () => {
    const state = createPitchStabilityState();

    expect(confirmStableMidiNote(state, 60, 3, 1)).toBeNull();
    expect(confirmStableMidiNote(state, 59, 3, 1)).toBeNull();
    expect(confirmStableMidiNote(state, 60, 3, 1)).toBe(60);
  });
});
