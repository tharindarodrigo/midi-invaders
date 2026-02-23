import type { InputNoteEvent } from '@/types/input';

const A4_FREQUENCY_HZ = 440;
const A4_MIDI_NOTE = 69;

const voiceGainFromVelocity = (velocity: number): number => {
  const normalized = Math.max(0, Math.min(127, velocity)) / 127;
  return 0.06 + normalized * 0.16;
};

export const midiNoteToFrequency = (note: number): number => {
  return A4_FREQUENCY_HZ * 2 ** ((note - A4_MIDI_NOTE) / 12);
};

const getAudioContextConstructor = (): typeof AudioContext | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return ctor ?? null;
};

interface ActiveVoice {
  oscillator: OscillatorNode;
  gain: GainNode;
}

export class KeyboardSynth {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private readonly activeVoices = new Map<number, ActiveVoice>();

  handleEvent(event: InputNoteEvent): void {
    if (event.source !== 'keyboard') {
      return;
    }

    if (event.type === 'note_on') {
      this.noteOn(event.note, event.velocity);
      return;
    }

    if (event.type === 'note_off') {
      this.noteOff(event.note);
    }
  }

  stopAll(): void {
    if (!this.context) {
      this.activeVoices.clear();
      return;
    }

    const now = this.context.currentTime;
    for (const [note, voice] of this.activeVoices) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0.0001, now, 0.025);
      voice.oscillator.stop(now + 0.12);
      this.activeVoices.delete(note);
    }
  }

  destroy(): void {
    const context = this.context;
    this.stopAll();
    this.masterGain?.disconnect();
    this.masterGain = null;
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
    masterGain.gain.value = 0.45;
    masterGain.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    return context;
  }

  private noteOn(note: number, velocity: number): void {
    const context = this.ensureContext();
    if (!context || !this.masterGain) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    this.noteOff(note);

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const targetGain = voiceGainFromVelocity(velocity);

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(midiNoteToFrequency(note), now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(targetGain, now + 0.016);
    gain.gain.exponentialRampToValueAtTime(targetGain * 0.82, now + 0.12);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);

    oscillator.onended = () => {
      const active = this.activeVoices.get(note);
      if (active?.oscillator === oscillator) {
        this.activeVoices.delete(note);
      }
      gain.disconnect();
    };

    this.activeVoices.set(note, { oscillator, gain });
  }

  private noteOff(note: number): void {
    const context = this.context;
    const voice = this.activeVoices.get(note);

    if (!context || !voice) {
      this.activeVoices.delete(note);
      return;
    }

    const now = context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, 0.04);
    voice.oscillator.stop(now + 0.18);
    this.activeVoices.delete(note);
  }
}
