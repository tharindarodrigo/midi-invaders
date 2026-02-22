import { describe, expect, it } from 'vitest';
import { noteNumberToName } from '@/services/note';

describe('noteNumberToName', () => {
  it('converts MIDI note 60 to C4', () => {
    expect(noteNumberToName(60)).toBe('C4');
  });

  it('converts sharps correctly', () => {
    expect(noteNumberToName(61)).toBe('C#4');
  });

  it('handles out-of-range notes safely', () => {
    expect(noteNumberToName(-1)).toBe('Unknown');
    expect(noteNumberToName(128)).toBe('Unknown');
  });
});
