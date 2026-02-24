import Phaser from 'phaser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createGameConfig } from '@/game/config';
import { gameBridge } from '@/game/gameBridge';
import {
  isAnalyticsEnabled,
  setAnalyticsEnabled as setAnalyticsEnabledPreference,
  trackAnalyticsEvent,
} from '@/services/analytics';
import { canStartWithInputMode, shouldProcessInputEvent } from '@/services/inputMode';
import { bindKeyboardFallback } from '@/services/keyboardFallback';
import { KeyboardSynth } from '@/services/keyboardSynth';
import { MicrophonePitchService, supportsMicrophoneInput } from '@/services/microphone';
import { MidiService, supportsWebMidi } from '@/services/midi';
import { getStoredMidiInputId, setStoredMidiInputId } from '@/services/midiPreferences';
import {
  DEFAULT_GAMEPLAY_SETTINGS,
  normalizeGameplaySettings,
} from '@/types/gameplay';
import type {
  ClefMode,
  DifficultyLevel,
  GameMode,
  GameplaySettings,
  LivesMode,
} from '@/types/gameplay';
import type {
  AnalyticsGameEndReason,
  AnalyticsInputMode,
  FeedbackLocation,
} from '@/types/analytics';
import type { HudState } from '@/types/hud';
import type { InputNoteEvent, MidiInputDevice } from '@/types/input';
import { HudOverlay } from '@/ui/HudOverlay';

const MAX_NOTE_HISTORY = 12;
const FEEDBACK_FORM_URL = 'https://forms.gle/Boz7dqVw8rJ8KpnN6';
const DISCORD_INVITE_URL = 'https://discord.gg/2pxrcPQU';

const initialHud: HudState = {
  score: 0,
  lifeScore: 0,
  lives: 3,
  wave: 1,
  activeInvaders: 0,
  scene: 'menu',
  mode: 'arcade',
  infiniteLives: false,
  lifeUpsEnabled: true,
};

interface ActiveAnalyticsSession {
  startedAtMs: number;
  inputMode: AnalyticsInputMode;
  settings: GameplaySettings;
}

const getNowMs = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

export default function App() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const midiServiceRef = useRef<MidiService | null>(null);
  const microphoneServiceRef = useRef<MicrophonePitchService | null>(null);
  const keyboardSynthRef = useRef<KeyboardSynth | null>(null);
  const canvasSectionRef = useRef<HTMLElement | null>(null);
  const containerId = 'phaser-game';

  const midiSupported = useMemo(() => supportsWebMidi(), []);
  const microphoneSupported = useMemo(() => supportsMicrophoneInput(), []);

  const [hud, setHud] = useState<HudState>(initialHud);
  const [midiStatus, setMidiStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [midiError, setMidiError] = useState<string | null>(null);
  const [microphoneStatus, setMicrophoneStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [midiDevices, setMidiDevices] = useState<MidiInputDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [selectedInputMode, setSelectedInputMode] = useState<AnalyticsInputMode>('keyboard');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(DEFAULT_GAMEPLAY_SETTINGS.difficulty);
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>(DEFAULT_GAMEPLAY_SETTINGS.mode);
  const [selectedClefMode, setSelectedClefMode] = useState<ClefMode>(DEFAULT_GAMEPLAY_SETTINGS.clefMode);
  const [selectedSpeedMultiplier, setSelectedSpeedMultiplier] = useState<number>(DEFAULT_GAMEPLAY_SETTINGS.speedMultiplier);
  const [selectedLivesMode, setSelectedLivesMode] = useState<LivesMode>(DEFAULT_GAMEPLAY_SETTINGS.livesMode);
  const [analyticsEnabled, setAnalyticsEnabledState] = useState<boolean>(() => isAnalyticsEnabled());
  const [noteHistory, setNoteHistory] = useState<InputNoteEvent[]>([]);
  const preferredInputIdRef = useRef<string | null>(getStoredMidiInputId());
  const selectedInputModeRef = useRef<AnalyticsInputMode>('keyboard');
  const selectedMidiInputIdRef = useRef<string | null>(null);
  const microphoneSuppressedRef = useRef(false);
  const hudRef = useRef<HudState>(initialHud);
  const previousHudSceneRef = useRef<HudState['scene']>(initialHud.scene);
  const lastGameHudRef = useRef<HudState>(initialHud);
  const activeAnalyticsSessionRef = useRef<ActiveAnalyticsSession | null>(null);

  const canStartGame = canStartWithInputMode(selectedInputMode, midiStatus, selectedInputId, microphoneStatus);
  const gameplaySettings = useMemo<GameplaySettings>(
    () =>
      normalizeGameplaySettings({
        difficulty: selectedDifficulty,
        mode: selectedGameMode,
        clefMode: selectedClefMode,
        speedMultiplier: selectedSpeedMultiplier,
        livesMode: selectedLivesMode,
      }),
    [
      selectedDifficulty,
      selectedGameMode,
      selectedClefMode,
      selectedSpeedMultiplier,
      selectedLivesMode,
    ],
  );

  const trackGameStarted = useCallback(
    (trigger: 'start' | 'restart') => {
      const session: ActiveAnalyticsSession = {
        startedAtMs: getNowMs(),
        inputMode: selectedInputMode,
        settings: gameplaySettings,
      };
      activeAnalyticsSessionRef.current = session;

      trackAnalyticsEvent('game_started', {
        trigger,
        input_mode: session.inputMode,
        mode: session.settings.mode,
        difficulty: session.settings.difficulty,
        clef_mode: session.settings.clefMode,
        speed_multiplier: session.settings.speedMultiplier,
        lives_mode: session.settings.livesMode,
      });
    },
    [gameplaySettings, selectedInputMode],
  );

  const trackGameEnded = useCallback((reason: AnalyticsGameEndReason, hudSnapshot?: HudState) => {
    const activeSession = activeAnalyticsSessionRef.current;
    if (!activeSession) {
      return;
    }

    const summary = hudSnapshot ?? hudRef.current;
    const durationMs = Math.max(0, Math.round(getNowMs() - activeSession.startedAtMs));

    trackAnalyticsEvent('game_ended', {
      reason,
      duration_ms: durationMs,
      score: summary.score,
      wave: summary.wave,
      lives: summary.lives,
      input_mode: activeSession.inputMode,
      mode: activeSession.settings.mode,
      difficulty: activeSession.settings.difficulty,
      clef_mode: activeSession.settings.clefMode,
      speed_multiplier: activeSession.settings.speedMultiplier,
      lives_mode: activeSession.settings.livesMode,
    });

    activeAnalyticsSessionRef.current = null;
  }, []);

  const handleInputEvent = useCallback((event: InputNoteEvent) => {
    if (event.source === 'microphone' && microphoneSuppressedRef.current) {
      return;
    }

    if (!shouldProcessInputEvent(selectedInputModeRef.current, selectedMidiInputIdRef.current, event)) {
      return;
    }

    keyboardSynthRef.current?.handleEvent(event);
    setNoteHistory((previous) => [event, ...previous].slice(0, MAX_NOTE_HISTORY));
    gameBridge.publishInput(event);
  }, []);

  const connectMidi = useCallback(async () => {
    trackAnalyticsEvent('midi_connect_attempted', {});

    if (!midiSupported) {
      setMidiStatus('error');
      setMidiError('Web MIDI is unavailable in this browser.');
      trackAnalyticsEvent('midi_connect_failed', { error_name: 'unsupported_browser' });
      return;
    }

    const service = midiServiceRef.current;
    if (!service) {
      trackAnalyticsEvent('midi_connect_failed', { error_name: 'service_unavailable' });
      return;
    }

    setMidiStatus('connecting');
    setMidiError(null);

    try {
      const devices = await service.connect();
      const preferredInputId = preferredInputIdRef.current;
      const hasPreferredInput = preferredInputId ? devices.some((device) => device.id === preferredInputId) : false;
      const selectedInput = hasPreferredInput ? service.selectInput(preferredInputId) : null;
      const selectedInputId = selectedInput?.id ?? service.getSelectedInputId();

      setMidiDevices(devices);
      setSelectedInputId(selectedInputId);
      setStoredMidiInputId(selectedInputId);
      preferredInputIdRef.current = selectedInputId;
      setMidiStatus('ready');
      trackAnalyticsEvent('midi_connected', {
        device_count: devices.length,
        selected_input_present: Boolean(selectedInputId),
      });
    } catch (error) {
      setMidiStatus('error');
      if (error instanceof Error) {
        setMidiError(error.message);
        trackAnalyticsEvent('midi_connect_failed', { error_name: error.name || 'Error' });
      } else {
        setMidiError('Unable to connect to MIDI devices.');
        trackAnalyticsEvent('midi_connect_failed', { error_name: 'unknown_error' });
      }
    }
  }, [midiSupported]);

  const connectMicrophone = useCallback(async () => {
    trackAnalyticsEvent('microphone_connect_attempted', {});

    if (!microphoneSupported) {
      setMicrophoneStatus('error');
      setMicrophoneError('Microphone input is unavailable in this browser.');
      trackAnalyticsEvent('microphone_connect_failed', { error_name: 'unsupported_browser' });
      return;
    }

    const service = microphoneServiceRef.current;
    if (!service) {
      trackAnalyticsEvent('microphone_connect_failed', { error_name: 'service_unavailable' });
      return;
    }

    setMicrophoneStatus('connecting');
    setMicrophoneError(null);

    try {
      service.disconnect();
      await service.connect();
      setMicrophoneStatus('ready');
      trackAnalyticsEvent('microphone_connected', {});
    } catch (error) {
      setMicrophoneStatus('error');
      if (error instanceof Error) {
        setMicrophoneError(error.message);
        trackAnalyticsEvent('microphone_connect_failed', { error_name: error.name || 'Error' });
      } else {
        setMicrophoneError('Unable to connect to microphone input.');
        trackAnalyticsEvent('microphone_connect_failed', { error_name: 'unknown_error' });
      }
    }
  }, [microphoneSupported]);

  const handleSelectMidiInput = useCallback((inputId: string) => {
    const service = midiServiceRef.current;
    if (!service) {
      return;
    }

    const selected = service.selectInput(inputId || null);
    setSelectedInputId(selected?.id ?? null);
    setStoredMidiInputId(selected?.id ?? null);
    preferredInputIdRef.current = selected?.id ?? null;
  }, []);

  const handleSelectInputMode = useCallback((nextMode: AnalyticsInputMode) => {
    setSelectedInputMode((previousMode) => {
      if (previousMode !== nextMode) {
        trackAnalyticsEvent('input_mode_selected', {
          input_mode: nextMode,
          previous_input_mode: previousMode,
          scene: hudRef.current.scene,
        });
      }

      return nextMode;
    });
  }, []);

  const handleToggleAnalytics = useCallback((enabled: boolean) => {
    const wasEnabled = isAnalyticsEnabled();
    if (wasEnabled === enabled) {
      setAnalyticsEnabledPreference(enabled);
      setAnalyticsEnabledState(enabled);
      return;
    }

    if (!enabled) {
      trackAnalyticsEvent('analytics_preference_changed', {
        enabled: false,
        source: 'hud_toggle',
      });
      setAnalyticsEnabledPreference(false);
      setAnalyticsEnabledState(false);
      return;
    }

    setAnalyticsEnabledPreference(true);
    setAnalyticsEnabledState(true);
    trackAnalyticsEvent('analytics_preference_changed', {
      enabled: true,
      source: 'hud_toggle',
    });
  }, []);

  const handleFeedbackFormOpen = useCallback((location: FeedbackLocation) => {
    trackAnalyticsEvent('feedback_form_opened', { location });
  }, []);

  useEffect(() => {
    selectedInputModeRef.current = selectedInputMode;
    setNoteHistory([]);

    if (selectedInputMode !== 'keyboard') {
      keyboardSynthRef.current?.stopAll();
    }
  }, [selectedInputMode]);

  useEffect(() => {
    selectedMidiInputIdRef.current = selectedInputId;
  }, [selectedInputId]);

  useEffect(() => {
    hudRef.current = hud;
    if (hud.scene === 'game') {
      lastGameHudRef.current = hud;
    }

    const previousScene = previousHudSceneRef.current;
    if (previousScene === 'game' && hud.scene === 'game-over') {
      trackGameEnded('game_over', lastGameHudRef.current);
    }

    previousHudSceneRef.current = hud.scene;
  }, [hud, trackGameEnded]);

  useEffect(() => {
    const config = createGameConfig(containerId);
    gameRef.current = new Phaser.Game(config);

    const midiService = new MidiService();
    const microphoneService = new MicrophonePitchService();
    const keyboardSynth = new KeyboardSynth();
    midiServiceRef.current = midiService;
    microphoneServiceRef.current = microphoneService;
    keyboardSynthRef.current = keyboardSynth;

    const unsubscribeHud = gameBridge.onHud((nextHud) => setHud(nextHud));
    const unsubscribeMicrophoneSuppression = gameBridge.onMicrophoneSuppression(({ suppressed }) => {
      microphoneSuppressedRef.current = suppressed;
    });
    const unsubscribeMidi = midiService.onNoteEvent((event) => handleInputEvent(event));
    const unsubscribeMicrophone = microphoneService.onNoteEvent((event) => handleInputEvent(event));
    const unsubscribeDevices = midiService.onDevicesChanged((devices) => {
      setMidiDevices(devices);
      const currentSelectedInputId = midiService.getSelectedInputId();

      if (!currentSelectedInputId && preferredInputIdRef.current) {
        const preferredDeviceStillAvailable = devices.some((device) => device.id === preferredInputIdRef.current);
        if (preferredDeviceStillAvailable) {
          const selected = midiService.selectInput(preferredInputIdRef.current);
          const selectedId = selected?.id ?? null;
          setSelectedInputId(selectedId);
          setStoredMidiInputId(selectedId);
          preferredInputIdRef.current = selectedId;
          return;
        }
      }

      setSelectedInputId(currentSelectedInputId);
      setStoredMidiInputId(currentSelectedInputId);
      preferredInputIdRef.current = currentSelectedInputId;
    });
    const unbindKeyboard = bindKeyboardFallback(handleInputEvent);

    return () => {
      unsubscribeHud();
      unsubscribeMicrophoneSuppression();
      unsubscribeMidi();
      unsubscribeMicrophone();
      unsubscribeDevices();
      unbindKeyboard();
      keyboardSynth.destroy();
      keyboardSynthRef.current = null;
      midiService.disconnect();
      midiServiceRef.current = null;
      microphoneService.disconnect();
      microphoneServiceRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      activeAnalyticsSessionRef.current = null;
    };
  }, [handleInputEvent]);

  useEffect(() => {
    void connectMidi();
  }, [connectMidi]);

  const startGame = useCallback(() => {
    if (hudRef.current.scene !== 'game') {
      trackGameStarted('start');
    }

    gameBridge.send({ type: 'start', settings: gameplaySettings });
  }, [gameplaySettings, trackGameStarted]);

  const restartGame = useCallback(() => {
    const currentScene = hudRef.current.scene;
    if (currentScene === 'game') {
      trackGameEnded('restart', lastGameHudRef.current);
    }

    if (currentScene === 'game' || currentScene === 'game-over') {
      trackGameStarted('restart');
    }

    gameBridge.send({ type: 'restart', settings: gameplaySettings });
  }, [gameplaySettings, trackGameEnded, trackGameStarted]);

  const endGame = useCallback(() => {
    if (hudRef.current.scene === 'game') {
      trackGameEnded('manual_end', lastGameHudRef.current);
    }

    gameBridge.send({ type: 'end' });
  }, [trackGameEnded]);

  const selectedInputModeLabel =
    selectedInputMode === 'keyboard'
      ? 'Computer Keyboard'
      : selectedInputMode === 'midi'
        ? 'MIDI Keyboard'
        : 'Microphone Pitch';
  const selectedGameModeLabel =
    selectedGameMode === 'practice'
      ? 'Practice'
      : selectedGameMode === 'pitch'
        ? 'Pitch Recognition'
        : 'Arcade';
  const startButtonLabel = canStartGame
    ? 'Play'
    : selectedInputMode === 'microphone'
      ? 'Connect Microphone to Play'
      : 'Connect MIDI to Play';
  const livesLabel = Number.isFinite(hud.lives) ? `${hud.lives}` : '∞';
  const overlayModeLabel =
    hud.mode === 'practice' ? 'Practice' : hud.mode === 'pitch' ? 'Pitch Recognition' : 'Arcade';
  const overlayMissPenalty = hud.mode === 'pitch' ? 25 : 50;

  return (
    <main className="app-root">
      <section className="landing-hero" aria-label="MIDI Invaders introduction">
        <img
          className="brand-logo-hero"
          src="/logo.png"
          alt="MIDI Invaders logo"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <p className="eyebrow">Free Online • Browser Arcade</p>
        <h1>MIDI Invaders</h1>
        <p className="hero-copy">
          Defend the galaxy with your keyboard. Match incoming notes, keep your combo alive, and climb the global leaderboard.
        </p>
        <div className="hero-actions">
          <button
            className="hero-button primary"
            disabled={!canStartGame}
            onClick={() => {
              canvasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              if (canStartGame) {
                startGame();
              }
            }}
          >
            Play Now
          </button>
          <button
            className="hero-button ghost"
            onClick={() => canvasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Setup Inputs
          </button>
        </div>
        <div className="hero-tags" aria-label="Feature highlights">
          <span>Arcade Waves</span>
          <span>MIDI + Mic + Keyboard</span>
          <span>Notation Training</span>
          <span>Global Leaderboard</span>
        </div>
      </section>

      <section className="play-shell" aria-label="Play MIDI Invaders">
        <HudOverlay
          selectedInputMode={selectedInputMode}
          midiSupported={midiSupported}
          midiStatus={midiStatus}
          midiError={midiError}
          microphoneSupported={microphoneSupported}
          microphoneStatus={microphoneStatus}
          microphoneError={microphoneError}
          midiDevices={midiDevices}
          selectedInputId={selectedInputId}
          selectedGameMode={selectedGameMode}
          selectedDifficulty={selectedDifficulty}
          selectedClefMode={selectedClefMode}
          selectedSpeedMultiplier={selectedSpeedMultiplier}
          selectedLivesMode={selectedLivesMode}
          noteHistory={noteHistory}
          analyticsEnabled={analyticsEnabled}
          onSelectInputMode={handleSelectInputMode}
          onConnectMidi={connectMidi}
          onConnectMicrophone={connectMicrophone}
          onSelectMidiInput={handleSelectMidiInput}
          onSelectGameMode={setSelectedGameMode}
          onSelectDifficulty={setSelectedDifficulty}
          onSelectClefMode={setSelectedClefMode}
          onSelectSpeedMultiplier={setSelectedSpeedMultiplier}
          onSelectLivesMode={setSelectedLivesMode}
          onToggleAnalytics={handleToggleAnalytics}
          onFeedbackLinkClick={handleFeedbackFormOpen}
          canStart={canStartGame}
          onStart={startGame}
          onEnd={endGame}
          onRestart={restartGame}
          feedbackFormUrl={FEEDBACK_FORM_URL}
        />
        <section ref={canvasSectionRef} className="game-canvas-shell" aria-label="Game canvas shell">
          <section id={containerId} className="game-canvas" aria-label="Game canvas" />
          {hud.scene === 'game' ? (
            <div className="game-stats-layer" aria-label="Gameplay stats">
              <aside className="game-stats-panel left">
                <p>Mode: {overlayModeLabel}</p>
                <p>Scene: {hud.scene}</p>
                <p>Wave: {hud.wave}</p>
                <p>Invaders: {hud.activeInvaders}</p>
              </aside>
              <aside className="game-stats-panel right">
                <p>Score: {hud.score}</p>
                <p>Lives: {livesLabel}</p>
                {hud.lifeUpsEnabled ? (
                  <>
                    <p>1UP Meter: {hud.lifeScore}/1000</p>
                    <p>Miss penalty: -{overlayMissPenalty} score, -{overlayMissPenalty} 1UP, +1s freeze</p>
                  </>
                ) : (
                  <>
                    <p>1UP Meter: Disabled</p>
                    <p>Miss penalty: -{overlayMissPenalty} score, +1s freeze</p>
                  </>
                )}
              </aside>
            </div>
          ) : null}
          {hud.scene === 'game-over' ? (
            <div className="game-instructions game-results" aria-label="Game results">
              <h2>Game Over</h2>
              <p className="result-line">Score: {hud.score}</p>
              <p className="result-line">Wave Reached: {hud.wave}</p>
              <p className="result-line">Lives Remaining: {livesLabel}</p>
              <a
                className="feedback-link-inline"
                href={FEEDBACK_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleFeedbackFormOpen('game_over')}
              >
                Share Feedback
              </a>
              <a
                className="community-link-inline"
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
              <button className="game-start-button" onClick={restartGame}>
                Play Again
              </button>
            </div>
          ) : null}
          {hud.scene !== 'game' && hud.scene !== 'game-over' ? (
            <div className="game-instructions" aria-label="How to play">
              <h2>
                {selectedGameMode === 'pitch'
                  ? 'Listen to each invader melody and play it back'
                  : 'Play by matching the note shown above each invader'}
              </h2>
              <p>
                Input Mode: <strong>{selectedInputModeLabel}</strong>. Game Mode: <strong>{selectedGameModeLabel}</strong>.
                {' '}
                Choose mode below, then press Play.
              </p>
              <div className="start-mode-switch" aria-label="Input mode switch">
                <button
                  className={`start-mode-button ${selectedInputMode === 'keyboard' ? 'active' : ''}`}
                  onClick={() => handleSelectInputMode('keyboard')}
                  type="button"
                >
                  Computer Keyboard
                </button>
                <button
                  className={`start-mode-button ${selectedInputMode === 'midi' ? 'active' : ''}`}
                  onClick={() => handleSelectInputMode('midi')}
                  type="button"
                >
                  MIDI Keyboard
                </button>
                <button
                  className={`start-mode-button ${selectedInputMode === 'microphone' ? 'active' : ''}`}
                  onClick={() => handleSelectInputMode('microphone')}
                  type="button"
                >
                  Microphone Pitch
                </button>
              </div>
              <p>
                {selectedInputMode === 'keyboard'
                  ? 'Keyboard mode is ready now. Use the key map below to play without a MIDI device.'
                  : selectedInputMode === 'midi'
                    ? 'MIDI mode requires a connected MIDI input device.'
                    : 'Microphone mode requires granting microphone access, then playing clear single pitches.'}
              </p>
              {selectedGameMode === 'pitch' ? (
                <p>Pitch mode is non-visual: invaders play repeating melodies. No note notation is shown.</p>
              ) : selectedGameMode === 'practice' ? (
                <p>Practice mode uses your custom clef, speed, and lives tuner from the left panel.</p>
              ) : selectedDifficulty === 2 ? (
                <p>Level 2 uses C2-C4 targets with an A3-C4 bass/treble overlap and up to two ledger lines per clef.</p>
              ) : null}
              <svg className="keyboard-svg" viewBox="0 0 420 146" role="img" aria-label="Keyboard guide">
                <rect x="0" y="0" width="420" height="146" rx="12" fill="rgb(15 23 42 / 72%)" stroke="rgb(34 211 238 / 48%)" />
                <g fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5">
                  <rect x="16" y="12" width="42" height="94" rx="4" />
                  <rect x="58" y="12" width="42" height="94" rx="4" />
                  <rect x="100" y="12" width="42" height="94" rx="4" />
                  <rect x="142" y="12" width="42" height="94" rx="4" />
                  <rect x="184" y="12" width="42" height="94" rx="4" />
                  <rect x="226" y="12" width="42" height="94" rx="4" />
                  <rect x="268" y="12" width="42" height="94" rx="4" />
                  <rect x="310" y="12" width="42" height="94" rx="4" />
                  <rect x="352" y="12" width="42" height="94" rx="4" />
                </g>
                <g fill="#0f172a">
                  <rect x="45" y="12" width="26" height="58" rx="3" />
                  <rect x="87" y="12" width="26" height="58" rx="3" />
                  <rect x="171" y="12" width="26" height="58" rx="3" />
                  <rect x="213" y="12" width="26" height="58" rx="3" />
                  <rect x="255" y="12" width="26" height="58" rx="3" />
                  <rect x="339" y="12" width="26" height="58" rx="3" />
                </g>
                <text x="24" y="122" fill="#e2e8f0" fontSize="12">
                  <tspan x="24" dy="0">
                    Keys: C4 (Z X C V B N M + S D G H J), C5 (W E R T Y U I + 3 4 6 7 8)
                  </tspan>
                  <tspan x="24" dy="14">
                    CapsLock ON: shift keyboard notes down 2 octaves (bass range).
                  </tspan>
                </text>
              </svg>
              <button
                className="game-start-button"
                disabled={!canStartGame}
                onClick={startGame}
              >
                {startButtonLabel}
              </button>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
