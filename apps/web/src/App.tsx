import Phaser from 'phaser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createGameConfig } from '@/game/config';
import { gameBridge } from '@/game/gameBridge';
import { bindKeyboardFallback } from '@/services/keyboardFallback';
import { MidiService, supportsWebMidi } from '@/services/midi';
import type { DifficultyLevel } from '@/types/gameplay';
import type { HudState } from '@/types/hud';
import type { InputNoteEvent, MidiInputDevice } from '@/types/input';
import { HudOverlay } from '@/ui/HudOverlay';

const MAX_NOTE_HISTORY = 12;

const initialHud: HudState = {
  score: 0,
  lives: 3,
  wave: 1,
  weaponCooldownMs: 0,
  activeInvaders: 0,
  scene: 'menu',
};

export default function App() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const midiServiceRef = useRef<MidiService | null>(null);
  const containerId = 'phaser-game';

  const midiSupported = useMemo(() => supportsWebMidi(), []);

  const [hud, setHud] = useState<HudState>(initialHud);
  const [midiStatus, setMidiStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [midiError, setMidiError] = useState<string | null>(null);
  const [midiDevices, setMidiDevices] = useState<MidiInputDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(1);
  const [noteHistory, setNoteHistory] = useState<InputNoteEvent[]>([]);

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
      setMidiDevices(devices);
      setSelectedInputId(service.getSelectedInputId());
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
      setSelectedInputId(midiService.getSelectedInputId());
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

  return (
    <main className="app-shell">
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
        onStart={() => gameBridge.send({ type: 'start', difficulty: selectedDifficulty })}
        onEnd={() => gameBridge.send({ type: 'end' })}
        onRestart={() => gameBridge.send({ type: 'restart', difficulty: selectedDifficulty })}
      />
      <section id={containerId} className="game-canvas" aria-label="Game canvas" />
    </main>
  );
}
