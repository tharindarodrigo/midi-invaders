import { midiNoteToFrequency } from '@/services/keyboardSynth';

const DEFAULT_NOTE_VELOCITY = 108;

const getAudioContextConstructor = (): typeof AudioContext | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return ctor ?? null;
};

const gainFromVelocity = (velocity: number): number => {
  const normalized = Math.max(0, Math.min(127, velocity)) / 127;
  return 0.05 + normalized * 0.14;
};

export const computePromptSequenceDurationMs = (
  noteCount: number,
  noteDurationMs: number,
  gapMs: number,
): number => {
  if (noteCount <= 0) {
    return 0;
  }

  return noteDurationMs * noteCount + gapMs * Math.max(0, noteCount - 1);
};

interface ActiveSequence {
  invaderId: string;
  timeoutIds: Array<ReturnType<typeof setTimeout>>;
  oscillators: Set<OscillatorNode>;
  cancelled: boolean;
}

export interface PromptSequenceOptions {
  invaderId: string;
  notes: number[];
  noteDurationMs: number;
  gapMs: number;
  velocity?: number;
  onNoteStart?: (note: number, index: number, invaderId: string) => void;
  onSequenceComplete?: (invaderId: string) => void;
}

export class InvaderPromptSynth {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeSequence: ActiveSequence | null = null;

  playSequence({
    invaderId,
    notes,
    noteDurationMs,
    gapMs,
    velocity = DEFAULT_NOTE_VELOCITY,
    onNoteStart,
    onSequenceComplete,
  }: PromptSequenceOptions): number {
    this.stop();
    const sequence: ActiveSequence = {
      invaderId,
      timeoutIds: [],
      oscillators: new Set(),
      cancelled: false,
    };
    this.activeSequence = sequence;

    const noteSpacingMs = noteDurationMs + gapMs;
    const sequenceDurationMs = computePromptSequenceDurationMs(notes.length, noteDurationMs, gapMs);

    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index];
      const delayMs = index * noteSpacingMs;
      const timeoutId = setTimeout(() => {
        if (sequence.cancelled) {
          return;
        }

        onNoteStart?.(note, index, invaderId);
        this.playNote(note, noteDurationMs, velocity, sequence);
      }, delayMs);
      sequence.timeoutIds.push(timeoutId);
    }

    const completeTimeoutId = setTimeout(() => {
      if (sequence.cancelled) {
        return;
      }

      this.activeSequence = null;
      onSequenceComplete?.(invaderId);
    }, sequenceDurationMs);
    sequence.timeoutIds.push(completeTimeoutId);

    return sequenceDurationMs;
  }

  stopInvader(invaderId: string): void {
    if (this.activeSequence?.invaderId !== invaderId) {
      return;
    }

    this.stop();
  }

  stop(): void {
    const activeSequence = this.activeSequence;
    if (!activeSequence) {
      return;
    }

    activeSequence.cancelled = true;
    for (const timeoutId of activeSequence.timeoutIds) {
      clearTimeout(timeoutId);
    }

    const context = this.context;
    if (context) {
      const now = context.currentTime;
      for (const oscillator of activeSequence.oscillators) {
        try {
          oscillator.stop(now);
        } catch {
          // Oscillator may already be stopped.
        }
      }
    }

    activeSequence.oscillators.clear();
    activeSequence.timeoutIds = [];
    this.activeSequence = null;
  }

  destroy(): void {
    this.stop();
    this.masterGain?.disconnect();
    this.masterGain = null;

    const context = this.context;
    this.context = null;
    if (context) {
      void context.close();
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }

    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) {
      return null;
    }

    const context = new AudioContextCtor();
    const masterGain = context.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    return context;
  }

  private playNote(note: number, noteDurationMs: number, velocity: number, sequence: ActiveSequence): void {
    const context = this.ensureContext();
    if (!context || !this.masterGain) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(midiNoteToFrequency(note), context.currentTime);

    const gain = context.createGain();
    const now = context.currentTime;
    const targetGain = gainFromVelocity(velocity);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(targetGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(targetGain * 0.8, now + 0.09);
    gain.gain.setTargetAtTime(0.0001, now + noteDurationMs / 1000, 0.028);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + noteDurationMs / 1000 + 0.12);
    sequence.oscillators.add(oscillator);

    oscillator.onended = () => {
      sequence.oscillators.delete(oscillator);
      gain.disconnect();
    };
  }
}

