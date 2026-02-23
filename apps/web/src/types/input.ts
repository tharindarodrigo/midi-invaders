export type NoteEventType = 'note_on' | 'note_off';

export type InputSource = 'midi' | 'keyboard' | 'microphone';

export interface InputNoteEvent {
  type: NoteEventType;
  note: number;
  velocity: number;
  channel: number;
  timestamp: number;
  source: InputSource;
  inputId?: string;
  inputName?: string;
}

export interface MidiInputDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: MIDIPortDeviceState;
  connection: MIDIPortConnectionState;
}
