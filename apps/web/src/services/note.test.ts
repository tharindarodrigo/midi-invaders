import { describe, expect, it } from 'vitest';
import { noteNumberToName } from '@/services/note';

describe('noteNumberToName', () => {
  it('converts MIDI note 60 to C4', () => {
    expect(noteNumberToName(60)).toBe('C4');
  });

  it('converts accidental notes using mixed sharp + flat spelling', () => {
    expect(noteNumberToName(61)).toBe('Db4');
    expect(noteNumberToName(66)).toBe('F#4');
    expect(noteNumberToName(70)).toBe('Bb4');
  });

  it('handles out-of-range notes safely', () => {
    expect(noteNumberToName(-1)).toBe('Unknown');
    expect(noteNumberToName(128)).toBe('Unknown');
  });
});
