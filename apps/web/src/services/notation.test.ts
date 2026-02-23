import { describe, expect, it } from 'vitest';
import { getCenteredStaveY, getStemDirectionForMidi, midiToVexKey } from '@/services/notation';

describe('midiToVexKey', () => {
  it('maps natural notes correctly', () => {
    expect(midiToVexKey(60)).toBe('c/4');
    expect(midiToVexKey(64)).toBe('e/4');
  });

  it('maps sharp notes correctly', () => {
    expect(midiToVexKey(61)).toBe('c#/4');
    expect(midiToVexKey(70)).toBe('a#/4');
  });
});

describe('getStemDirectionForMidi', () => {
  it('uses downward stems for treble notes above the center line', () => {
    expect(getStemDirectionForMidi(72, 'treble')).toBe(-1);
    expect(getStemDirectionForMidi(83, 'treble')).toBe(-1);
  });

  it('keeps upward stems on and below the treble center line', () => {
    expect(getStemDirectionForMidi(71, 'treble')).toBe(1);
    expect(getStemDirectionForMidi(60, 'treble')).toBe(1);
  });
});

describe('getCenteredStaveY', () => {
  it('applies the upward visual offset for circular-invader centering', () => {
    expect(getCenteredStaveY(160)).toBe(48);
  });
});
