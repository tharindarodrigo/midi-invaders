import type { HudState } from '@/types/hud';
import type { GameplaySettings } from '@/types/gameplay';
import type { InputNoteEvent } from '@/types/input';

type GameCommand =
  | { type: 'start'; settings: GameplaySettings }
  | { type: 'end' }
  | { type: 'restart'; settings: GameplaySettings };

interface MicrophoneSuppressionState {
  suppressed: boolean;
}

const COMMAND_EVENT = 'game-command';
const HUD_EVENT = 'hud-update';
const INPUT_EVENT = 'input-note-event';
const MICROPHONE_SUPPRESSION_EVENT = 'microphone-suppression-event';

class GameBridge {
  private readonly target = new EventTarget();

  send(command: GameCommand): void {
    this.target.dispatchEvent(new CustomEvent<GameCommand>(COMMAND_EVENT, { detail: command }));
  }

  onCommand(listener: (command: GameCommand) => void): () => void {
    const handler = (event: Event) => {
      listener((event as CustomEvent<GameCommand>).detail);
    };

    this.target.addEventListener(COMMAND_EVENT, handler);
    return () => this.target.removeEventListener(COMMAND_EVENT, handler);
  }

  publishHud(state: HudState): void {
    this.target.dispatchEvent(new CustomEvent<HudState>(HUD_EVENT, { detail: state }));
  }

  onHud(listener: (state: HudState) => void): () => void {
    const handler = (event: Event) => {
      listener((event as CustomEvent<HudState>).detail);
    };

    this.target.addEventListener(HUD_EVENT, handler);
    return () => this.target.removeEventListener(HUD_EVENT, handler);
  }

  publishInput(event: InputNoteEvent): void {
    this.target.dispatchEvent(new CustomEvent<InputNoteEvent>(INPUT_EVENT, { detail: event }));
  }

  onInput(listener: (event: InputNoteEvent) => void): () => void {
    const handler = (event: Event) => {
      listener((event as CustomEvent<InputNoteEvent>).detail);
    };

    this.target.addEventListener(INPUT_EVENT, handler);
    return () => this.target.removeEventListener(INPUT_EVENT, handler);
  }

  publishMicrophoneSuppression(state: MicrophoneSuppressionState): void {
    this.target.dispatchEvent(
      new CustomEvent<MicrophoneSuppressionState>(MICROPHONE_SUPPRESSION_EVENT, { detail: state }),
    );
  }

  onMicrophoneSuppression(listener: (state: MicrophoneSuppressionState) => void): () => void {
    const handler = (event: Event) => {
      listener((event as CustomEvent<MicrophoneSuppressionState>).detail);
    };

    this.target.addEventListener(MICROPHONE_SUPPRESSION_EVENT, handler);
    return () => this.target.removeEventListener(MICROPHONE_SUPPRESSION_EVENT, handler);
  }
}

export const gameBridge = new GameBridge();
