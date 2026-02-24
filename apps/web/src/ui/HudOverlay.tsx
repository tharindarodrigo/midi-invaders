import type { ClefMode, DifficultyLevel, GameMode, LivesMode } from '@/types/gameplay';
import { noteNumberToName } from '@/services/note';
import type { AnalyticsInputMode } from '@/types/analytics';
import type { HudState } from '@/types/hud';
import type { InputNoteEvent, MidiInputDevice } from '@/types/input';

const DISCORD_INVITE_URL = 'https://discord.gg/2pxrcPQU';

interface HudOverlayProps {
  selectedInputMode: AnalyticsInputMode;
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
  currentScene: HudState['scene'];
  noteHistory: InputNoteEvent[];
  analyticsEnabled: boolean;
  onSelectInputMode: (mode: AnalyticsInputMode) => void;
  onConnectMidi: () => void;
  onConnectMicrophone: () => void;
  onSelectMidiInput: (inputId: string) => void;
  onSelectGameMode: (mode: GameMode) => void;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
  onSelectClefMode: (clefMode: ClefMode) => void;
  onSelectSpeedMultiplier: (multiplier: number) => void;
  onSelectLivesMode: (livesMode: LivesMode) => void;
  onToggleAnalytics: (enabled: boolean) => void;
  onOpenFeedbackPanel: () => void;
  feedbackPanelLabel: string;
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
  currentScene,
  noteHistory,
  analyticsEnabled,
  onSelectInputMode,
  onConnectMidi,
  onConnectMicrophone,
  onSelectMidiInput,
  onSelectGameMode,
  onSelectDifficulty,
  onSelectClefMode,
  onSelectSpeedMultiplier,
  onSelectLivesMode,
  onToggleAnalytics,
  onOpenFeedbackPanel,
  feedbackPanelLabel,
  canStart,
  onStart,
  onEnd,
  onRestart,
}: HudOverlayProps) {
  return (
    <aside className="hud-panel">
      <div className="hud-title">
        <img
          className="hud-title-logo"
          src="/logo.png"
          alt="MIDI Invaders logo"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <h1>MIDI Invaders</h1>
      </div>
      <label className="input-label" htmlFor="input-mode">
        Input Mode
      </label>
      <select
        id="input-mode"
        className="device-select"
        value={selectedInputMode}
        onChange={(event) => onSelectInputMode(event.target.value as AnalyticsInputMode)}
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
        <option value="pitch">Pitch Recognition</option>
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
      {selectedGameMode === 'pitch' ? (
        <p className="status">Listen to each invader melody and play it back in order.</p>
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
      <label className="analytics-toggle">
        <input
          type="checkbox"
          checked={analyticsEnabled}
          onChange={(event) => onToggleAnalytics(event.target.checked)}
        />
        <span>Enable anonymous analytics</span>
      </label>
      <p className="analytics-note">Helps improve gameplay balance and onboarding. No personal data is tracked.</p>

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
      {currentScene === 'game-over' ? (
        <button className="feedback-link-hud-btn" onClick={onOpenFeedbackPanel} type="button">
          {feedbackPanelLabel}
        </button>
      ) : null}
      <a
        className="community-link-hud"
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg className="community-link-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M20.32 4.37a19.8 19.8 0 0 0-4.95-1.54.07.07 0 0 0-.07.03c-.21.38-.44.88-.6 1.27a18.35 18.35 0 0 0-5.39 0c-.16-.4-.4-.9-.61-1.27a.08.08 0 0 0-.08-.03c-1.7.29-3.35.81-4.94 1.54a.08.08 0 0 0-.03.03C.54 7.4-.32 10.34.1 13.24a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.96 3.01.08.08 0 0 0 .09-.03c.46-.63.88-1.3 1.24-2a.08.08 0 0 0-.04-.11 13 13 0 0 1-1.9-.91.08.08 0 0 1-.01-.13c.13-.1.26-.2.38-.31a.08.08 0 0 1 .08-.01c4 1.83 8.34 1.83 12.3 0a.08.08 0 0 1 .08.01c.13.11.25.21.38.31a.08.08 0 0 1-.01.13c-.6.35-1.23.65-1.9.91a.08.08 0 0 0-.04.11c.37.7.78 1.37 1.24 2a.08.08 0 0 0 .09.03 19.8 19.8 0 0 0 5.96-3.01.08.08 0 0 0 .03-.06c.5-3.36-.84-6.27-3.52-8.84a.06.06 0 0 0-.03-.03Zm-11.88 7.1c-1.2 0-2.18-1.1-2.18-2.45s.97-2.45 2.18-2.45c1.2 0 2.18 1.1 2.18 2.45 0 1.36-.97 2.45-2.18 2.45Zm7.12 0c-1.2 0-2.18-1.1-2.18-2.45s.97-2.45 2.18-2.45c1.2 0 2.18 1.1 2.18 2.45 0 1.36-.97 2.45-2.18 2.45Z"
          />
        </svg>
        Join our discord community
      </a>
    </aside>
  );
}
