import type { InputNoteEvent } from '@/types/input';

type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type NoteListener = (event: InputNoteEvent) => void;

// Ignore very quiet/noisy frames so ambient hiss does not trigger false notes.
const MIN_RMS = 0.01;
// Emit note_off only after consecutive silent frames to reduce jittery note toggles.
const SILENCE_FRAMES_FOR_NOTE_OFF = 6;
// Require the same detected note across a few frames before emitting note_on/switch.
const NOTE_STABILITY_FRAMES = 3;
// 2048 balances pitch stability and latency for real-time gameplay.
const PITCH_DETECTION_FFT_SIZE = 2048;
const DEFAULT_MICROPHONE_VELOCITY = 100;

export interface PitchStabilityState {
  candidateNote: number | null;
  candidateFrames: number;
}

export const createPitchStabilityState = (): PitchStabilityState => ({
  candidateNote: null,
  candidateFrames: 0,
});

export const resetPitchStabilityState = (state: PitchStabilityState): void => {
  state.candidateNote = null;
  state.candidateFrames = 0;
};

export const confirmStableMidiNote = (
  state: PitchStabilityState,
  detectedNote: number | null,
  requiredFrames: number = NOTE_STABILITY_FRAMES,
): number | null => {
  if (detectedNote === null) {
    resetPitchStabilityState(state);
    return null;
  }

  if (state.candidateNote === detectedNote) {
    state.candidateFrames += 1;
  } else {
    state.candidateNote = detectedNote;
    state.candidateFrames = 1;
  }

  return state.candidateFrames >= requiredFrames ? state.candidateNote : null;
};

const createAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const audioWindow = window as WebAudioWindow;
  const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }

  return new AudioContextConstructor();
};

export const supportsMicrophoneInput = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(window.AudioContext || (window as WebAudioWindow).webkitAudioContext);
};

export const frequencyToMidiNote = (frequency: number): number | null => {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null;
  }

  // Equal temperament reference: A4 = MIDI 69 = 440Hz.
  return Math.round(69 + 12 * Math.log2(frequency / 440));
};

export const detectPitchFromBuffer = (buffer: Float32Array, sampleRate: number): number | null => {
  const size = buffer.length;
  let rms = 0;
  for (let index = 0; index < size; index += 1) {
    const value = buffer[index];
    rms += value * value;
  }
  rms = Math.sqrt(rms / size);

  if (rms < MIN_RMS) {
    return null;
  }

  const correlations = new Float32Array(size);
  for (let offset = 0; offset < size; offset += 1) {
    let correlation = 0;
    for (let index = 0; index + offset < size; index += 1) {
      correlation += buffer[index] * buffer[index + offset];
    }
    correlations[offset] = correlation;
  }

  let firstDip = 0;
  while (firstDip + 1 < size && correlations[firstDip] > correlations[firstDip + 1]) {
    firstDip += 1;
  }

  let maxCorrelation = -1;
  let bestOffset = -1;
  for (let offset = firstDip; offset < size; offset += 1) {
    const correlation = correlations[offset];
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset <= 0) {
    return null;
  }

  return sampleRate / bestOffset;
};

export class MicrophonePitchService {
  private readonly noteListeners = new Set<NoteListener>();
  private readonly pitchStabilityState = createPitchStabilityState();
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private rafId: number | null = null;
  private activeNote: number | null = null;
  private silenceFrames = 0;

  async connect(): Promise<void> {
    if (this.audioContext && this.mediaStream) {
      return;
    }

    if (!supportsMicrophoneInput()) {
      throw new Error('Microphone pitch input is unavailable in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // Disable voice-call style processing to preserve raw pitch information.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const audioContext = createAudioContext();
    if (!audioContext) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('Unable to initialize audio context for microphone input.');
    }

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = PITCH_DETECTION_FFT_SIZE;
    source.connect(analyser);

    this.audioContext = audioContext;
    this.mediaStream = stream;
    this.sourceNode = source;
    this.analyserNode = analyser;
    this.startPitchLoop();
  }

  disconnect(): void {
    if (this.rafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.activeNote !== null) {
      this.emitNoteEvent(this.toEvent('note_off', this.activeNote, 0));
      this.activeNote = null;
    }

    this.silenceFrames = 0;
    resetPitchStabilityState(this.pitchStabilityState);
    this.sourceNode?.disconnect();
    this.analyserNode?.disconnect();
    this.sourceNode = null;
    this.analyserNode = null;
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }

  onNoteEvent(listener: NoteListener): () => void {
    this.noteListeners.add(listener);
    return () => this.noteListeners.delete(listener);
  }

  private startPitchLoop(): void {
    const analyser = this.analyserNode;
    const audioContext = this.audioContext;
    if (!analyser || !audioContext || typeof window === 'undefined') {
      return;
    }

    const data = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(data);
      const frequency = detectPitchFromBuffer(data, audioContext.sampleRate);
      const midiNote = frequency !== null ? frequencyToMidiNote(frequency) : null;
      if (midiNote !== null) {
        const stableNote = confirmStableMidiNote(this.pitchStabilityState, midiNote);
        if (stableNote !== null) {
          if (this.activeNote === null) {
            this.activeNote = stableNote;
            this.emitNoteEvent(this.toEvent('note_on', stableNote, DEFAULT_MICROPHONE_VELOCITY));
          } else if (this.activeNote !== stableNote) {
            this.emitNoteEvent(this.toEvent('note_off', this.activeNote, 0));
            this.activeNote = stableNote;
            this.emitNoteEvent(this.toEvent('note_on', stableNote, DEFAULT_MICROPHONE_VELOCITY));
          }
        }
        this.silenceFrames = 0;
      } else {
        resetPitchStabilityState(this.pitchStabilityState);
        if (this.activeNote !== null) {
          this.silenceFrames += 1;
          if (this.silenceFrames >= SILENCE_FRAMES_FOR_NOTE_OFF) {
            this.emitNoteEvent(this.toEvent('note_off', this.activeNote, 0));
            this.activeNote = null;
            this.silenceFrames = 0;
          }
        }
      }

      this.rafId = window.requestAnimationFrame(tick);
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  private toEvent(type: InputNoteEvent['type'], note: number, velocity: number): InputNoteEvent {
    return {
      type,
      note,
      velocity,
      channel: 1,
      timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      source: 'microphone',
      inputId: 'microphone',
      inputName: 'Microphone',
    };
  }

  private emitNoteEvent(event: InputNoteEvent): void {
    for (const listener of this.noteListeners) {
      listener(event);
    }
  }
}
