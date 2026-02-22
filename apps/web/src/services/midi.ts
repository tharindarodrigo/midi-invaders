import type { InputNoteEvent, MidiInputDevice } from '@/types/input';

type WebMidiNavigator = Navigator & {
  requestMIDIAccess?: () => Promise<MIDIAccess>;
};

type NotePayload = Pick<InputNoteEvent, 'type' | 'note' | 'velocity' | 'channel'>;

type NoteListener = (event: InputNoteEvent) => void;
type DevicesListener = (devices: MidiInputDevice[]) => void;

export const supportsWebMidi = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return typeof (navigator as WebMidiNavigator).requestMIDIAccess === 'function';
};

export const requestMidiAccess = async (): Promise<MIDIAccess | null> => {
  if (!supportsWebMidi()) {
    return null;
  }

  return (navigator as WebMidiNavigator).requestMIDIAccess?.() ?? null;
};

export const parseMidiMessage = (data: Uint8Array): NotePayload | null => {
  if (data.length < 3) {
    return null;
  }

  const status = data[0];
  const note = data[1];
  const velocity = data[2];
  const messageType = status & 0xf0;
  const channel = (status & 0x0f) + 1;

  if (messageType === 0x90 && velocity > 0) {
    return {
      type: 'note_on',
      note,
      velocity,
      channel,
    };
  }

  if (messageType === 0x80 || (messageType === 0x90 && velocity === 0)) {
    return {
      type: 'note_off',
      note,
      velocity,
      channel,
    };
  }

  return null;
};

const mapDevice = (input: MIDIInput): MidiInputDevice => ({
  id: input.id,
  name: input.name ?? 'Unknown Input',
  manufacturer: input.manufacturer ?? 'Unknown',
  state: input.state,
  connection: input.connection,
});

export class MidiService {
  private access: MIDIAccess | null = null;
  private selectedInput: MIDIInput | null = null;
  private readonly noteListeners = new Set<NoteListener>();
  private readonly devicesListeners = new Set<DevicesListener>();

  async connect(): Promise<MidiInputDevice[]> {
    this.access = await requestMidiAccess();
    if (!this.access) {
      return [];
    }

    this.access.onstatechange = () => {
      this.emitDevicesChanged();

      if (this.selectedInput) {
        const stillExists = this.access?.inputs.get(this.selectedInput.id);
        if (!stillExists) {
          this.selectInput(null);
        }
      }
    };

    const devices = this.getDevices();
    this.emitDevicesChanged();

    if (devices.length > 0 && !this.selectedInput) {
      this.selectInput(devices[0].id);
    }

    return devices;
  }

  getDevices(): MidiInputDevice[] {
    if (!this.access) {
      return [];
    }

    return [...this.access.inputs.values()].map(mapDevice);
  }

  getSelectedInputId(): string | null {
    return this.selectedInput?.id ?? null;
  }

  selectInput(inputId: string | null): MidiInputDevice | null {
    if (this.selectedInput) {
      this.selectedInput.onmidimessage = null;
      this.selectedInput = null;
    }

    if (!this.access || !inputId) {
      return null;
    }

    const input = this.access.inputs.get(inputId);
    if (!input) {
      return null;
    }

    input.onmidimessage = (messageEvent) => {
      const data = messageEvent.data;
      if (!data) {
        return;
      }

      const parsed = parseMidiMessage(data);
      if (!parsed) {
        return;
      }

      const event: InputNoteEvent = {
        ...parsed,
        source: 'midi',
        timestamp: messageEvent.timeStamp,
        inputId: input.id,
        inputName: input.name ?? 'Unknown Input',
      };

      this.emitNoteEvent(event);
    };

    this.selectedInput = input;
    return mapDevice(input);
  }

  onNoteEvent(listener: NoteListener): () => void {
    this.noteListeners.add(listener);
    return () => this.noteListeners.delete(listener);
  }

  onDevicesChanged(listener: DevicesListener): () => void {
    this.devicesListeners.add(listener);
    return () => this.devicesListeners.delete(listener);
  }

  disconnect(): void {
    if (this.selectedInput) {
      this.selectedInput.onmidimessage = null;
      this.selectedInput = null;
    }

    if (this.access) {
      this.access.onstatechange = null;
      this.access = null;
    }
  }

  private emitNoteEvent(event: InputNoteEvent): void {
    for (const listener of this.noteListeners) {
      listener(event);
    }
  }

  private emitDevicesChanged(): void {
    const devices = this.getDevices();
    for (const listener of this.devicesListeners) {
      listener(devices);
    }
  }
}
