import type { DifficultyLevel } from '@/types/gameplay';
import { noteNumberToName } from '@/services/note';
import type { HudState } from '@/types/hud';
import type { InputNoteEvent, MidiInputDevice } from '@/types/input';

interface HudOverlayProps {
  selectedInputMode: 'keyboard' | 'midi';
  midiSupported: boolean;
  midiStatus: 'idle' | 'connecting' | 'ready' | 'error';
  midiError: string | null;
  midiDevices: MidiInputDevice[];
  selectedInputId: string | null;
  selectedDifficulty: DifficultyLevel;
  noteHistory: InputNoteEvent[];
  hud: HudState;
  onSelectInputMode: (mode: 'keyboard' | 'midi') => void;
  onConnectMidi: () => void;
  onSelectMidiInput: (inputId: string) => void;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
  canStart: boolean;
  onStart: () => void;
  onEnd: () => void;
  onRestart: () => void;
}

const statusLabel = (status: HudOverlayProps['midiStatus']): string => {
  if (status === 'connecting') {
    return 'Connecting';
  }

  if (status === 'ready') {
    return 'Connected';
  }

  if (status === 'error') {
    return 'Error';
  }

  return 'Idle';
};

export function HudOverlay({
  selectedInputMode,
  midiSupported,
  midiStatus,
  midiError,
  midiDevices,
  selectedInputId,
  selectedDifficulty,
  noteHistory,
  hud,
  onSelectInputMode,
  onConnectMidi,
  onSelectMidiInput,
  onSelectDifficulty,
  canStart,
  onStart,
  onEnd,
  onRestart,
}: HudOverlayProps) {
  return (
    <aside className="hud-panel">
      <h1>MIDI Invaders</h1>
      <label className="input-label" htmlFor="input-mode">
        Input Mode
      </label>
      <select
        id="input-mode"
        className="device-select"
        value={selectedInputMode}
        onChange={(event) => onSelectInputMode(event.target.value as 'keyboard' | 'midi')}
      >
        <option value="keyboard">Computer Keyboard</option>
        <option value="midi">MIDI Keyboard</option>
      </select>

      {selectedInputMode === 'midi' ? (
        <>
          <p className="status">MIDI: {midiSupported ? statusLabel(midiStatus) : 'Not available'}</p>
          {midiSupported ? (
            <>
              <button onClick={onConnectMidi} disabled={midiStatus === 'connecting'}>
                {midiStatus === 'ready' ? 'Reconnect MIDI' : 'Connect MIDI'}
              </button>
              <label className="input-label" htmlFor="midi-input">
                Input Device
              </label>
              <select
                id="midi-input"
                className="device-select"
                value={selectedInputId ?? ''}
                onChange={(event) => onSelectMidiInput(event.target.value)}
              >
                <option value="">Select input</option>
                {midiDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} ({device.manufacturer})
                  </option>
                ))}
              </select>
              {midiError ? <p className="error">{midiError}</p> : null}
            </>
          ) : (
            <p className="error">Web MIDI is unavailable in this browser. Switch to Computer Keyboard mode.</p>
          )}
        </>
      ) : (
        <>
          <p className="status">Keyboard mode ready</p>
          <p>Use the on-canvas key map to play from C4 to B5.</p>
        </>
      )}

      <label className="input-label" htmlFor="difficulty-level">
        Difficulty
      </label>
      <select
        id="difficulty-level"
        className="device-select"
        value={selectedDifficulty}
        onChange={(event) => onSelectDifficulty(Number(event.target.value) as DifficultyLevel)}
      >
        <option value={1}>Level 1 (Very Slow)</option>
        <option value={2}>Level 2</option>
        <option value={3}>Level 3</option>
      </select>

      <hr className="divider" />

      <p>Scene: {hud.scene}</p>
      <p>Wave: {hud.wave}</p>
      <p>Score: {hud.score}</p>
      <p>1UP Meter: {hud.lifeScore}/1000</p>
      <p>Lives: {hud.lives}</p>
      <p>Invaders: {hud.activeInvaders}</p>
      <p>Miss penalty: -50 score, -50 1UP meter, +1s freeze</p>
      <p>Life-up power-up: center green pulse clears nearest 5 invaders</p>

      <h2 className="subheading">Recent Notes</h2>
      <ul className="note-list">
        {noteHistory.length === 0 ? <li>No note input yet.</li> : null}
        {noteHistory.map((entry) => (
          <li key={`${entry.timestamp}-${entry.note}-${entry.type}`}>
            {entry.type === 'note_on' ? 'ON' : 'OFF'} {noteNumberToName(entry.note)} ({entry.note}) [{entry.source}]
          </li>
        ))}
      </ul>

      <div className="buttons">
        <button onClick={onStart} disabled={!canStart}>
          Start
        </button>
        <button onClick={onEnd}>End Game</button>
        <button onClick={onRestart}>Restart</button>
      </div>
    </aside>
  );
}
