import Phaser from 'phaser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createGameConfig } from '@/game/config';
import { gameBridge } from '@/game/gameBridge';
import { bindKeyboardFallback } from '@/services/keyboardFallback';
import { MidiService, supportsWebMidi } from '@/services/midi';
import { getStoredMidiInputId, setStoredMidiInputId } from '@/services/midiPreferences';
import type { DifficultyLevel } from '@/types/gameplay';
import type { HudState } from '@/types/hud';
import type { InputNoteEvent, MidiInputDevice } from '@/types/input';
import { HudOverlay } from '@/ui/HudOverlay';

const MAX_NOTE_HISTORY = 12;

const initialHud: HudState = {
  score: 0,
  lives: 3,
  wave: 1,
  activeInvaders: 0,
  scene: 'menu',
};

export default function App() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const midiServiceRef = useRef<MidiService | null>(null);
  const canvasSectionRef = useRef<HTMLElement | null>(null);
  const containerId = 'phaser-game';

  const midiSupported = useMemo(() => supportsWebMidi(), []);

  const [hud, setHud] = useState<HudState>(initialHud);
  const [midiStatus, setMidiStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [midiError, setMidiError] = useState<string | null>(null);
  const [midiDevices, setMidiDevices] = useState<MidiInputDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(1);
  const [noteHistory, setNoteHistory] = useState<InputNoteEvent[]>([]);
  const preferredInputIdRef = useRef<string | null>(getStoredMidiInputId());

  const handleInputEvent = useCallback((event: InputNoteEvent) => {
    setNoteHistory((previous) => [event, ...previous].slice(0, MAX_NOTE_HISTORY));
    gameBridge.publishInput(event);
  }, []);

  const connectMidi = useCallback(async () => {
    if (!midiSupported) {
      setMidiStatus('error');
      setMidiError('Web MIDI is unavailable in this browser.');
      return;
    }

    const service = midiServiceRef.current;
    if (!service) {
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
    } catch (error) {
      setMidiStatus('error');
      if (error instanceof Error) {
        setMidiError(error.message);
      } else {
        setMidiError('Unable to connect to MIDI devices.');
      }
    }
  }, [midiSupported]);

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

  useEffect(() => {
    const config = createGameConfig(containerId);
    gameRef.current = new Phaser.Game(config);

    const midiService = new MidiService();
    midiServiceRef.current = midiService;

    const unsubscribeHud = gameBridge.onHud((nextHud) => setHud(nextHud));
    const unsubscribeMidi = midiService.onNoteEvent((event) => handleInputEvent(event));
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
      unsubscribeMidi();
      unsubscribeDevices();
      unbindKeyboard();
      midiService.disconnect();
      midiServiceRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [handleInputEvent]);

  useEffect(() => {
    void connectMidi();
  }, [connectMidi]);

  const canStartGame = midiStatus === 'ready' && selectedInputId !== null;

  return (
    <main className="app-root">
      <section className="landing-hero" aria-label="MIDI Invaders introduction">
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
                gameBridge.send({ type: 'start', difficulty: selectedDifficulty });
              }
            }}
          >
            Play Now
          </button>
          <button
            className="hero-button ghost"
            onClick={() => canvasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Setup MIDI
          </button>
        </div>
        <div className="hero-tags" aria-label="Feature highlights">
          <span>Arcade Waves</span>
          <span>MIDI + Keyboard</span>
          <span>Notation Training</span>
          <span>Global Leaderboard</span>
        </div>
      </section>

      <section className="play-shell" aria-label="Play MIDI Invaders">
        <HudOverlay
          midiSupported={midiSupported}
          midiStatus={midiStatus}
          midiError={midiError}
          midiDevices={midiDevices}
          selectedInputId={selectedInputId}
          selectedDifficulty={selectedDifficulty}
          noteHistory={noteHistory}
          hud={hud}
          onConnectMidi={connectMidi}
          onSelectMidiInput={handleSelectMidiInput}
          onSelectDifficulty={setSelectedDifficulty}
          canStart={canStartGame}
          onStart={() => gameBridge.send({ type: 'start', difficulty: selectedDifficulty })}
          onEnd={() => gameBridge.send({ type: 'end' })}
          onRestart={() => gameBridge.send({ type: 'restart', difficulty: selectedDifficulty })}
        />
        <section ref={canvasSectionRef} className="game-canvas-shell" aria-label="Game canvas shell">
          <section id={containerId} className="game-canvas" aria-label="Game canvas" />
          {hud.scene === 'game-over' ? (
            <div className="game-instructions game-results" aria-label="Game results">
              <h2>Game Over</h2>
              <p className="result-line">Score: {hud.score}</p>
              <p className="result-line">Wave Reached: {hud.wave}</p>
              <p className="result-line">Lives Remaining: {hud.lives}</p>
              <button className="game-start-button" onClick={() => gameBridge.send({ type: 'restart', difficulty: selectedDifficulty })}>
                Play Again
              </button>
            </div>
          ) : null}
          {hud.scene !== 'game' && hud.scene !== 'game-over' ? (
            <div className="game-instructions" aria-label="How to play">
              <h2>Play by matching the note shown above each invader</h2>
              <p>Connect your MIDI keyboard, pick your device, then press Play. Hit matching notes before invaders reach the core.</p>
              <svg className="keyboard-svg" viewBox="0 0 420 126" role="img" aria-label="Keyboard guide">
                <rect x="0" y="0" width="420" height="126" rx="12" fill="rgb(15 23 42 / 72%)" stroke="rgb(34 211 238 / 48%)" />
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
                <text x="24" y="120" fill="#e2e8f0" fontSize="12">Tip: C4 is MIDI 60. Match note names exactly.</text>
              </svg>
              <button
                className="game-start-button"
                disabled={!canStartGame}
                onClick={() => gameBridge.send({ type: 'start', difficulty: selectedDifficulty })}
              >
                {canStartGame ? 'Play' : 'Connect MIDI to Play'}
              </button>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
