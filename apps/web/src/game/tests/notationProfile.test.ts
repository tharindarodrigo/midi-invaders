import { describe, expect, it } from 'vitest';
import { getNotePoolForClefMode, resolveInvaderClef } from '@/game/notationProfile';

describe('notation profile', () => {
  it('returns clef-specific note pools for practice mode', () => {
    const treble = getNotePoolForClefMode('treble');
    const bass = getNotePoolForClefMode('bass');
    const any = getNotePoolForClefMode('any');

    expect(treble[0]).toBe(57);
    expect(treble[treble.length - 1]).toBe(84);
    expect(bass[0]).toBe(36);
    expect(bass[bass.length - 1]).toBe(64);
    expect(any[0]).toBe(36);
    expect(any[any.length - 1]).toBe(84);
  });

  it('resolves fixed treble/bass selections directly', () => {
    expect(resolveInvaderClef('treble', 36, 'invader-3')).toBe('treble');
    expect(resolveInvaderClef('bass', 72, 'invader-7')).toBe('bass');
  });

  it('alternates overlap notes across bass and treble for any-clef mode', () => {
    expect(resolveInvaderClef('any', 57, 'invader-2')).toBe('bass');
    expect(resolveInvaderClef('any', 57, 'invader-3')).toBe('treble');
    expect(resolveInvaderClef('any', 36, 'invader-8')).toBe('bass');
    expect(resolveInvaderClef('any', 84, 'invader-9')).toBe('treble');
  });
});
