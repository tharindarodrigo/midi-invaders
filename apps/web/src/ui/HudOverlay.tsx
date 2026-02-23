import type { ClefMode, DifficultyLevel, GameMode, LivesMode } from '@/types/gameplay';
import { noteNumberToName } from '@/services/note';
import type { HudState } from '@/types/hud';
import type { InputNoteEvent, MidiInputDevice } from '@/types/input';

interface HudOverlayProps {
  selectedInputMode: 'keyboard' | 'midi' | 'microphone';
  midiSupported: boolean;
  midiStatus: 'idle' | 'connecting' | 'ready' | 'error';
  midiError: string | null;
  microphoneSupported: boolean;
  microphoneStatus: 'idle' | 'connecting' | 'ready' | 'error';
  microphoneError: string | null;
  midiDevices: MidiInputDevice[];
  selectedInputId: string | null;
  selectedGameMode: GameMode;
  selectedDifficulty: DifficultyLevel;
  selectedClefMode: ClefMode;
  selectedSpeedMultiplier: number;
  selectedLivesMode: LivesMode;
  noteHistory: InputNoteEvent[];
  hud: HudState;
  onSelectInputMode: (mode: 'keyboard' | 'midi' | 'microphone') => void;
  onConnectMidi: () => void;
  onConnectMicrophone: () => void;
  onSelectMidiInput: (inputId: string) => void;
  onSelectGameMode: (mode: GameMode) => void;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
  onSelectClefMode: (clefMode: ClefMode) => void;
  onSelectSpeedMultiplier: (multiplier: number) => void;
  onSelectLivesMode: (livesMode: LivesMode) => void;
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
  microphoneSupported,
  microphoneStatus,
  microphoneError,
  midiDevices,
  selectedInputId,
  selectedGameMode,
  selectedDifficulty,
  selectedClefMode,
  selectedSpeedMultiplier,
  selectedLivesMode,
  noteHistory,
  hud,
  onSelectInputMode,
  onConnectMidi,
  onConnectMicrophone,
  onSelectMidiInput,
  onSelectGameMode,
  onSelectDifficulty,
  onSelectClefMode,
  onSelectSpeedMultiplier,
  onSelectLivesMode,
  canStart,
  onStart,
  onEnd,
  onRestart,
}: HudOverlayProps) {
  const runningSession = hud.scene === 'game';
  const activeMode = runningSession ? hud.mode : selectedGameMode;
  const lifeUpsEnabled = runningSession
    ? hud.lifeUpsEnabled
    : !(selectedGameMode === 'practice' && selectedLivesMode === 'infinite');
  const livesLabel = runningSession && !Number.isFinite(hud.lives) ? '∞' : `${hud.lives}`;

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
        onChange={(event) => onSelectInputMode(event.target.value as 'keyboard' | 'midi' | 'microphone')}
      >
        <option value="keyboard">Computer Keyboard</option>
        <option value="midi">MIDI Keyboard</option>
        <option value="microphone">Microphone Pitch</option>
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
      ) : selectedInputMode === 'microphone' ? (
        <>
          <p className="status">
            Microphone: {microphoneSupported ? statusLabel(microphoneStatus) : 'Not available'}
          </p>
          {microphoneSupported ? (
            <>
              <button onClick={onConnectMicrophone} disabled={microphoneStatus === 'connecting'}>
                {microphoneStatus === 'ready' ? 'Reconnect Microphone' : 'Connect Microphone'}
              </button>
              <p>Play a clear single pitch to trigger note matching from your instrument or voice.</p>
              {microphoneError ? <p className="error">{microphoneError}</p> : null}
            </>
          ) : (
            <p className="error">Microphone input is unavailable in this browser. Switch to Keyboard or MIDI mode.</p>
          )}
        </>
      ) : (
        <>
          <p className="status">Keyboard mode ready</p>
          <p>Use the on-canvas key map to play from C4 to B5. Enable CapsLock to shift two octaves down.</p>
          {selectedGameMode === 'practice' && selectedClefMode !== 'treble' ? (
            <p className="status">For lower bass notes, toggle CapsLock while using the same keys.</p>
          ) : null}
        </>
      )}

      <label className="input-label" htmlFor="game-mode">
        Mode
      </label>
      <select
        id="game-mode"
        className="device-select"
        value={selectedGameMode}
        onChange={(event) => onSelectGameMode(event.target.value as GameMode)}
      >
        <option value="arcade">Arcade</option>
        <option value="practice">Practice</option>
      </select>

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
        <option value={2}>Level 2 (Bass + Treble Overlap)</option>
        <option value={3}>Level 3</option>
      </select>
      {selectedGameMode === 'arcade' && selectedDifficulty === 2 ? (
        <p className="status">Level 2 targets span C2-C4. A3-C4 overlap may show in either clef.</p>
      ) : null}
      {selectedGameMode === 'practice' ? (
        <>
          <label className="input-label" htmlFor="practice-clef">
            Clefs
          </label>
          <select
            id="practice-clef"
            className="device-select"
            value={selectedClefMode}
            onChange={(event) => onSelectClefMode(event.target.value as ClefMode)}
          >
            <option value="treble">Treble</option>
            <option value="bass">Bass</option>
            <option value="any">Any (smart clef by range)</option>
          </select>

          <label className="input-label" htmlFor="practice-speed">
            Speed
          </label>
          <select
            id="practice-speed"
            className="device-select"
            value={selectedSpeedMultiplier}
            onChange={(event) => onSelectSpeedMultiplier(Number(event.target.value))}
          >
            <option value={0.75}>Slow</option>
            <option value={1}>Normal</option>
            <option value={1.25}>Fast</option>
          </select>

          <label className="input-label" htmlFor="practice-lives">
            Lives
          </label>
          <select
            id="practice-lives"
            className="device-select"
            value={selectedLivesMode}
            onChange={(event) => onSelectLivesMode(event.target.value as LivesMode)}
          >
            <option value="default">Default (3 lives + 1UP)</option>
            <option value="infinite">Infinite (no 1UP / pulse)</option>
          </select>
        </>
      ) : null}

      <hr className="divider" />

      <p>Mode: {activeMode === 'practice' ? 'Practice' : 'Arcade'}</p>
      <p>Scene: {hud.scene}</p>
      <p>Wave: {hud.wave}</p>
      <p>Score: {hud.score}</p>
      <p>Lives: {livesLabel}</p>
      <p>Invaders: {hud.activeInvaders}</p>
      {lifeUpsEnabled ? (
        <>
          <p>1UP Meter: {hud.lifeScore}/1000</p>
          <p>Miss penalty: -50 score, -50 1UP meter, +1s freeze</p>
          <p>Life-up power-up: center green pulse clears nearest 5 invaders</p>
        </>
      ) : (
        <>
          <p>1UP Meter: Disabled</p>
          <p>Miss penalty: -50 score, +1s freeze</p>
          <p>Infinite-lives practice disables 1UP and pulse power-up.</p>
        </>
      )}

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
