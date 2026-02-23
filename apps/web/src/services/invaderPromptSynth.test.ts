import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvaderPromptSynth, computePromptSequenceDurationMs } from '@/services/invaderPromptSynth';

afterEach(() => {
  vi.useRealTimers();
});

describe('computePromptSequenceDurationMs', () => {
  it('computes full sequence duration with note durations and inter-note gaps', () => {
    expect(computePromptSequenceDurationMs(1, 280, 120)).toBe(280);
    expect(computePromptSequenceDurationMs(3, 280, 120)).toBe(1080);
  });
});

describe('invader prompt synth scheduling', () => {
  it('stops pending callbacks when the active sequence is cancelled', () => {
    vi.useFakeTimers();
    const synth = new InvaderPromptSynth();
    const played: number[] = [];
    let completed = 0;

    synth.playSequence({
      invaderId: 'invader-1',
      notes: [60, 62, 64],
      noteDurationMs: 280,
      gapMs: 120,
      onNoteStart: (note) => played.push(note),
      onSequenceComplete: () => {
        completed += 1;
      },
    });

    vi.advanceTimersByTime(401);
    expect(played).toEqual([60, 62]);

    synth.stop();
    vi.advanceTimersByTime(2000);

    expect(played).toEqual([60, 62]);
    expect(completed).toBe(0);
    synth.destroy();
  });
});

