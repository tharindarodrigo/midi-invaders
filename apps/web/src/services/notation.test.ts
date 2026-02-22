import { describe, expect, it } from 'vitest';
import { midiToVexKey } from '@/services/notation';

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
