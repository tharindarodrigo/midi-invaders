import { describe, expect, it } from 'vitest';
import { midiNoteToFrequency } from '@/services/keyboardSynth';

describe('midiNoteToFrequency', () => {
  it('maps A4 to 440Hz', () => {
    expect(midiNoteToFrequency(69)).toBeCloseTo(440, 6);
  });

  it('maps C4 near 261.63Hz', () => {
    expect(midiNoteToFrequency(60)).toBeCloseTo(261.625565, 6);
  });

  it('doubles frequency every 12 semitones', () => {
    const c4 = midiNoteToFrequency(60);
    const c5 = midiNoteToFrequency(72);
    expect(c5).toBeCloseTo(c4 * 2, 6);
  });
});
