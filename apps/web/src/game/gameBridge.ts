import type { HudState } from '@/types/hud';
import type { DifficultyLevel } from '@/types/gameplay';
import type { InputNoteEvent } from '@/types/input';

type GameCommand =
  | { type: 'start'; difficulty: DifficultyLevel }
  | { type: 'end' }
  | { type: 'restart'; difficulty: DifficultyLevel };

const COMMAND_EVENT = 'game-command';
const HUD_EVENT = 'hud-update';
const INPUT_EVENT = 'input-note-event';

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
}

export const gameBridge = new GameBridge();
