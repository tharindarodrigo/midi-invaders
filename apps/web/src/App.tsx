import Phaser from 'phaser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FeedbackSubmitRequest } from '@midi-invaders/shared';
import { createGameConfig } from '@/game/config';
import { gameBridge } from '@/game/gameBridge';
import {
  isAnalyticsEnabled,
  setAnalyticsEnabled as setAnalyticsEnabledPreference,
  trackAnalyticsEvent,
} from '@/services/analytics';
import {
  createSessionForGameplay,
  issueFeedbackToken,
  submitFeedback,
} from '@/services/api';
import {
  canStartWithInputMode,
  resolvePreferredInputMode,
  shouldProcessInputEvent,
} from '@/services/inputMode';
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
} from '@/types/analytics';
import type { HudState } from '@/types/hud';
import type { InputNoteEvent, MidiInputDevice } from '@/types/input';
import { HudOverlay } from '@/ui/HudOverlay';

const MAX_NOTE_HISTORY = 12;
const DISCORD_INVITE_URL = 'https://discord.gg/2pxrcPQU';
const FEEDBACK_FORM_LOCATION = 'game_over';

type FeedbackFormStatus = 'idle' | 'submitting' | 'success' | 'error';

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

interface CompletedRunSnapshot {
  inputMode: AnalyticsInputMode;
  settings: GameplaySettings;
  durationMs: number;
  score: number;
  wave: number;
}

interface BackendFeedbackSession {
  sessionId: string;
  token: string | null;
  tokenExpiresAtMs: number;
  startedAtMs: number;
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
  const isLikelyMobile = useMemo(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  }, []);
  const initialInputMode = useMemo<AnalyticsInputMode>(
    () => resolvePreferredInputMode(isLikelyMobile, microphoneSupported),
    [isLikelyMobile, microphoneSupported],
  );

  const [hud, setHud] = useState<HudState>(initialHud);
  const [midiStatus, setMidiStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [midiError, setMidiError] = useState<string | null>(null);
  const [microphoneStatus, setMicrophoneStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [midiDevices, setMidiDevices] = useState<MidiInputDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [selectedInputMode, setSelectedInputMode] = useState<AnalyticsInputMode>(initialInputMode);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(DEFAULT_GAMEPLAY_SETTINGS.difficulty);
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>(DEFAULT_GAMEPLAY_SETTINGS.mode);
  const [selectedClefMode, setSelectedClefMode] = useState<ClefMode>(DEFAULT_GAMEPLAY_SETTINGS.clefMode);
  const [selectedSpeedMultiplier, setSelectedSpeedMultiplier] = useState<number>(DEFAULT_GAMEPLAY_SETTINGS.speedMultiplier);
  const [selectedLivesMode, setSelectedLivesMode] = useState<LivesMode>(DEFAULT_GAMEPLAY_SETTINGS.livesMode);
  const [analyticsEnabled, setAnalyticsEnabledState] = useState<boolean>(() => isAnalyticsEnabled());
  const [noteHistory, setNoteHistory] = useState<InputNoteEvent[]>([]);
  const [feedbackRating, setFeedbackRating] = useState<1 | 2 | 3 | 4 | 5 | 0>(0);
  const [feedbackHoverRating, setFeedbackHoverRating] = useState<1 | 2 | 3 | 4 | 5 | 0>(0);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [feedbackFormStatus, setFeedbackFormStatus] = useState<FeedbackFormStatus>('idle');
  const [feedbackFormMessage, setFeedbackFormMessage] = useState<string | null>(null);
  const [isFeedbackPanelVisible, setIsFeedbackPanelVisible] = useState<boolean>(true);
  const preferredInputIdRef = useRef<string | null>(getStoredMidiInputId());
  const selectedInputModeRef = useRef<AnalyticsInputMode>(initialInputMode);
  const selectedMidiInputIdRef = useRef<string | null>(null);
  const microphoneSuppressedRef = useRef(false);
  const hudRef = useRef<HudState>(initialHud);
  const previousHudSceneRef = useRef<HudState['scene']>(initialHud.scene);
  const lastGameHudRef = useRef<HudState>(initialHud);
  const activeAnalyticsSessionRef = useRef<ActiveAnalyticsSession | null>(null);
  const lastCompletedRunRef = useRef<CompletedRunSnapshot | null>(null);
  const backendFeedbackSessionRef = useRef<BackendFeedbackSession | null>(null);

  const canStartGame = canStartWithInputMode(selectedInputMode, midiStatus, selectedInputId, microphoneStatus);
  const gameplaySettings = useMemo<GameplaySettings>(
    () =>
      normalizeGameplaySettings({
        difficulty:
          selectedGameMode === 'arcade'
            ? DEFAULT_GAMEPLAY_SETTINGS.difficulty
            : selectedDifficulty,
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

  const resetFeedbackForm = useCallback(() => {
    setFeedbackRating(0);
    setFeedbackHoverRating(0);
    setFeedbackMessage('');
    setFeedbackFormStatus('idle');
    setFeedbackFormMessage(null);
    setIsFeedbackPanelVisible(true);
  }, []);

  const beginBackendFeedbackSession = useCallback(async (settings: GameplaySettings) => {
    try {
      const session = await createSessionForGameplay(settings);
      const token = await issueFeedbackToken(session.sessionId);
      backendFeedbackSessionRef.current = {
        sessionId: session.sessionId,
        token: token.token,
        tokenExpiresAtMs: new Date(token.expiresAt).getTime(),
        startedAtMs: getNowMs(),
      };
    } catch (error) {
      backendFeedbackSessionRef.current = null;
      if (error instanceof Error) {
        setFeedbackFormMessage(error.message);
      } else {
        setFeedbackFormMessage('Feedback service is unavailable right now.');
      }
    }
  }, []);

  const ensureFeedbackToken = useCallback(async (sessionId: string): Promise<string> => {
    const active = backendFeedbackSessionRef.current;
    if (
      active
      && active.sessionId === sessionId
      && active.token
      && Date.now() < active.tokenExpiresAtMs - 1000
    ) {
      return active.token;
    }

    const refreshed = await issueFeedbackToken(sessionId);
    backendFeedbackSessionRef.current = {
      sessionId,
      token: refreshed.token,
      tokenExpiresAtMs: new Date(refreshed.expiresAt).getTime(),
      startedAtMs: active?.startedAtMs ?? getNowMs(),
    };

    return refreshed.token;
  }, []);

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

    lastCompletedRunRef.current = {
      inputMode: activeSession.inputMode,
      settings: activeSession.settings,
      durationMs,
      score: summary.score,
      wave: summary.wave,
    };

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

  const handleFeedbackSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (feedbackRating < 1 || feedbackRating > 5) {
      setFeedbackFormStatus('error');
      setFeedbackFormMessage('Please choose a star rating before submitting.');
      return;
    }

    const feedbackSession = backendFeedbackSessionRef.current;
    if (!feedbackSession) {
      setFeedbackFormStatus('error');
      setFeedbackFormMessage('Feedback is unavailable for this round. Please start a new game first.');
      return;
    }

    setFeedbackFormStatus('submitting');
    setFeedbackFormMessage(null);
    trackAnalyticsEvent('feedback_submission_attempted', { location: FEEDBACK_FORM_LOCATION });

    const completedRun = lastCompletedRunRef.current;
    const hudSnapshot = lastGameHudRef.current;
    const rating = feedbackRating as 1 | 2 | 3 | 4 | 5;

    try {
      const token = await ensureFeedbackToken(feedbackSession.sessionId);
      const payload: FeedbackSubmitRequest = {
        sessionId: feedbackSession.sessionId,
        token,
        rating,
        feedback: feedbackMessage.trim(),
        honeypot: '',
        mode: completedRun?.settings.mode ?? gameplaySettings.mode,
        difficulty: completedRun?.settings.difficulty ?? gameplaySettings.difficulty,
        wave: Math.max(0, completedRun?.wave ?? hudSnapshot.wave),
        score: Math.max(0, completedRun?.score ?? hudSnapshot.score),
        durationMs: Math.max(
          0,
          completedRun?.durationMs
          ?? Math.round(getNowMs() - feedbackSession.startedAtMs),
        ),
        inputMode: completedRun?.inputMode ?? selectedInputModeRef.current,
      };

      await submitFeedback(payload);
      setFeedbackFormStatus('success');
      setFeedbackFormMessage('Thank you. Your feedback was received and queued for personal review.');
      setIsFeedbackPanelVisible(false);
      trackAnalyticsEvent('feedback_submitted', {
        location: FEEDBACK_FORM_LOCATION,
        rating,
        has_message: payload.feedback.length > 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit feedback right now.';
      setFeedbackFormStatus('error');
      setFeedbackFormMessage(message);
      trackAnalyticsEvent('feedback_submit_failed', {
        location: FEEDBACK_FORM_LOCATION,
        error_name: error instanceof Error ? (error.name || 'Error') : 'unknown_error',
      });
    }
  }, [ensureFeedbackToken, feedbackMessage, feedbackRating, gameplaySettings]);

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
      lastCompletedRunRef.current = null;
      backendFeedbackSessionRef.current = null;
    };
  }, [handleInputEvent]);

  useEffect(() => {
    void connectMidi();
  }, [connectMidi]);

  const startGame = useCallback(() => {
    if (hudRef.current.scene !== 'game') {
      trackGameStarted('start');
    }

    resetFeedbackForm();
    lastCompletedRunRef.current = null;
    backendFeedbackSessionRef.current = null;
    gameBridge.send({ type: 'start', settings: gameplaySettings });
    void beginBackendFeedbackSession(gameplaySettings);
  }, [beginBackendFeedbackSession, gameplaySettings, resetFeedbackForm, trackGameStarted]);

  const restartGame = useCallback(() => {
    const currentScene = hudRef.current.scene;
    if (currentScene === 'game') {
      trackGameEnded('restart', lastGameHudRef.current);
    }

    if (currentScene === 'game' || currentScene === 'game-over') {
      trackGameStarted('restart');
    }

    resetFeedbackForm();
    lastCompletedRunRef.current = null;
    backendFeedbackSessionRef.current = null;
    gameBridge.send({ type: 'restart', settings: gameplaySettings });
    void beginBackendFeedbackSession(gameplaySettings);
  }, [beginBackendFeedbackSession, gameplaySettings, resetFeedbackForm, trackGameEnded, trackGameStarted]);

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
  const startButtonLabel = 'Play';
  const heroPrimaryBusy =
    (selectedInputMode === 'microphone' && microphoneStatus === 'connecting')
    || (selectedInputMode === 'midi' && midiStatus === 'connecting');
  const heroPrimaryLabel = canStartGame
    ? 'Play Now'
    : selectedInputMode === 'microphone'
      ? microphoneStatus === 'connecting'
        ? 'Connecting Microphone...'
        : 'Connect Microphone'
      : selectedInputMode === 'midi'
        ? midiStatus === 'connecting'
          ? 'Connecting MIDI...'
          : 'Connect MIDI'
        : 'Play Now';
  const livesLabel = Number.isFinite(hud.lives) ? `${hud.lives}` : '∞';
  const overlayMissPenalty = hud.mode === 'pitch' ? 25 : 50;
  const gameplayFocusedLayout = hud.scene === 'game';
  const feedbackVisibleRating = feedbackHoverRating > 0 ? feedbackHoverRating : feedbackRating;
  const hasSubmittedFeedback = feedbackFormStatus === 'success';
  const feedbackPanelLabel = hasSubmittedFeedback ? 'View Feedback Status' : 'Open Feedback Form';

  return (
    <main className="app-root">
      <section className="landing-hero" aria-label="MIDI Invaders introduction">
        <div className="hero-layout">
          <div className="hero-content">
            <p className="eyebrow">Free Online • Browser Arcade</p>
            <h1>MIDI Invaders</h1>
            <p className="hero-copy">
              Defend the galaxy with your keyboard. Match incoming notes, keep your combo alive, and climb the global leaderboard.
            </p>
            <div className="hero-actions">
              <button
                className="hero-button primary"
                disabled={heroPrimaryBusy}
                onClick={() => {
                  canvasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  if (canStartGame) {
                    startGame();
                    return;
                  }

                  if (selectedInputMode === 'microphone') {
                    void connectMicrophone();
                    return;
                  }

                  if (selectedInputMode === 'midi') {
                    void connectMidi();
                  }
                }}
              >
                {heroPrimaryLabel}
              </button>
              <button
                className="hero-button ghost"
                onClick={() => canvasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Setup Inputs
              </button>
            </div>
          </div>
          <img
            className="brand-logo-hero"
            src="/logo.png"
            alt="MIDI Invaders logo"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>
        <div className="hero-tags" aria-label="Feature highlights">
          <span>Arcade Waves</span>
          <span>MIDI + Mic + Keyboard</span>
          <span>Notation Training</span>
          <span>Global Leaderboard</span>
        </div>
      </section>

      <section className={`play-shell ${gameplayFocusedLayout ? 'gameplay-focus' : ''}`} aria-label="Play MIDI Invaders">
        <div className={`hud-panel-shell ${gameplayFocusedLayout ? 'is-hidden' : ''}`}>
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
            currentScene={hud.scene}
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
            onOpenFeedbackPanel={() => setIsFeedbackPanelVisible(true)}
            feedbackPanelLabel={feedbackPanelLabel}
            canStart={canStartGame}
            onStart={startGame}
            onEnd={endGame}
            onRestart={restartGame}
          />
        </div>
        <section ref={canvasSectionRef} className="game-canvas-shell" aria-label="Game canvas shell">
          <section id={containerId} className="game-canvas" aria-label="Game canvas" />
          {hud.scene === 'game' ? (
            <>
              <div className="game-stats-layer" aria-label="Gameplay stats">
                <aside className="game-stats-panel score-overlay">
                  <p className="game-score-title">Score</p>
                  <p className="game-score-value">{hud.score.toLocaleString()}</p>
                  <p className="game-stat-row">
                    <span className="game-stat-label">Lives</span>
                    <span className="game-stat-value">{livesLabel}</span>
                  </p>
                  {hud.lifeUpsEnabled ? (
                    <>
                      <p className="game-stat-row">
                        <span className="game-stat-label">1UP Meter</span>
                        <span className="game-stat-value">{hud.lifeScore}/1000</span>
                      </p>
                      <p className="game-stat-note">
                        Miss: -{overlayMissPenalty} score, -{overlayMissPenalty} 1UP, +1s freeze
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="game-stat-row">
                        <span className="game-stat-label">1UP Meter</span>
                        <span className="game-stat-value">Disabled</span>
                      </p>
                      <p className="game-stat-note">Miss: -{overlayMissPenalty} score, +1s freeze</p>
                    </>
                  )}
                </aside>
              </div>
              <button className="game-exit-button" onClick={endGame} type="button">
                End Game
              </button>
            </>
          ) : null}
          {hud.scene === 'game-over' ? (
            <div className="game-instructions game-results" aria-label="Game results">
              <h2>Game Over</h2>
              <p className="result-line">Score: {hud.score}</p>
              <p className="result-line">Wave Reached: {hud.wave}</p>
              <p className="result-line">Lives Remaining: {livesLabel}</p>
              {isFeedbackPanelVisible ? (
                hasSubmittedFeedback ? (
                  <div className="feedback-form-inline">
                    <p className="feedback-form-copy">
                      Thank you. Your feedback has been received and queued for personal review.
                    </p>
                    <p className="feedback-form-copy">
                      We personally review every submission and continuously tune the gameplay from this feedback.
                    </p>
                  </div>
                ) : (
                  <form className="feedback-form-inline" onSubmit={handleFeedbackSubmit}>
                    <p className="feedback-form-copy">
                      We are continuously reviewing and improving the quality of the gameplay experience.
                      Share what kept you engaged or where you dropped off.
                    </p>
                    <p className="feedback-form-copy">
                      Every submission is personally reviewed by our team. We do not use AI to review player feedback.
                    </p>
                    <label className="feedback-label" htmlFor="feedback-rating">
                      Overall Experience
                    </label>
                    <div
                      id="feedback-rating"
                      className="feedback-stars"
                      role="radiogroup"
                      aria-label="Overall experience rating"
                      onMouseLeave={() => setFeedbackHoverRating(0)}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          className={`feedback-star ${feedbackVisibleRating >= star ? 'is-active' : ''}`}
                          type="button"
                          role="radio"
                          aria-checked={feedbackRating === star}
                          onMouseEnter={() => setFeedbackHoverRating(star as 1 | 2 | 3 | 4 | 5)}
                          onClick={() => setFeedbackRating(star as 1 | 2 | 3 | 4 | 5)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <label className="feedback-label" htmlFor="feedback-message">
                      Feedback
                    </label>
                    <textarea
                      id="feedback-message"
                      className="feedback-textarea"
                      maxLength={1200}
                      value={feedbackMessage}
                      onChange={(event) => setFeedbackMessage(event.target.value)}
                      placeholder="Tell us what felt fun, frustrating, or confusing."
                    />
                    <input
                      className="feedback-honeypot"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      value=""
                      readOnly
                    />
                    {feedbackFormMessage ? (
                      <p className={`feedback-form-status ${feedbackFormStatus === 'error' ? 'is-error' : ''}`}>
                        {feedbackFormMessage}
                      </p>
                    ) : null}
                    <button
                      className="feedback-submit-button"
                      type="submit"
                      disabled={feedbackFormStatus === 'submitting' || feedbackRating === 0}
                    >
                      {feedbackFormStatus === 'submitting' ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </form>
                )
              ) : null}
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
                  ? isLikelyMobile
                    ? 'Keyboard mode on phones/tablets requires a connected hardware keyboard.'
                    : 'Keyboard mode is ready now. Use the key map below to play without a MIDI device.'
                  : selectedInputMode === 'midi'
                    ? 'MIDI mode requires a connected MIDI input device.'
                    : 'Microphone mode requires granting microphone access, then playing clear single pitches.'}
              </p>
              {isLikelyMobile && selectedInputMode === 'keyboard' ? (
                <p className="status">Mobile note: Computer Keyboard mode requires a hardware keyboard on phone.</p>
              ) : null}
              {selectedGameMode === 'pitch' ? (
                <p>Pitch mode is non-visual: invaders play repeating melodies. No note notation is shown.</p>
              ) : selectedGameMode === 'practice' ? (
                <p>Practice mode uses your custom clef, speed, and lives tuner from the left panel.</p>
              ) : (
                <p>Arcade runs a 6-wave loop: treble singles, mixed-clef singles, then major chord waves.</p>
              )}
              {selectedInputMode === 'keyboard' ? (
                <>
                  <svg className="keyboard-svg" viewBox="0 0 420 118" role="img" aria-label="Keyboard guide">
                    <rect x="0" y="0" width="420" height="118" rx="12" fill="rgb(15 23 42 / 72%)" stroke="rgb(34 211 238 / 48%)" />
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
                  </svg>
                  <div className="keyboard-instructions" aria-label="Keyboard mapping instructions">
                    <p>Keys: C4 (Z X C V B N M + S D G H J)</p>
                    <p>Keys: C5 (W E R T Y U I + 3 4 6 7 8)</p>
                    <p>CapsLock ON shifts notes down 2 octaves (bass range)</p>
                  </div>
                </>
              ) : null}
              {selectedInputMode === 'microphone' && microphoneStatus !== 'ready' ? (
                <button
                  className="start-connect-button"
                  type="button"
                  onClick={() => {
                    void connectMicrophone();
                  }}
                  disabled={microphoneStatus === 'connecting'}
                >
                  {microphoneStatus === 'connecting' ? 'Connecting Microphone...' : 'Connect Microphone'}
                </button>
              ) : null}
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
