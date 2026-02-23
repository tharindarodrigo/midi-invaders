import type { InputNoteEvent, InputSource } from '@/types/input';

export type InputMode = InputSource;
export type MidiStatus = 'idle' | 'connecting' | 'ready' | 'error';

export const canStartWithInputMode = (
  inputMode: InputMode,
  midiStatus: MidiStatus,
  selectedMidiInputId: string | null,
  microphoneStatus: MidiStatus,
): boolean => {
  if (inputMode === 'keyboard') {
    return true;
  }

  if (inputMode === 'microphone') {
    return microphoneStatus === 'ready';
  }

  return midiStatus === 'ready' && selectedMidiInputId !== null;
};

export const shouldProcessInputEvent = (
  inputMode: InputMode,
  selectedMidiInputId: string | null,
  event: InputNoteEvent,
): boolean => {
  if (event.source !== inputMode) {
    return false;
  }

  if (inputMode === 'midi' && selectedMidiInputId && event.inputId && event.inputId !== selectedMidiInputId) {
    return false;
  }

  return true;
};
