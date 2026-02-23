import type { GameMode } from '@/types/gameplay';

export interface HudState {
  score: number;
  lifeScore: number;
  lives: number;
  wave: number;
  activeInvaders: number;
  scene: 'menu' | 'game' | 'game-over';
  mode: GameMode;
  infiniteLives: boolean;
  lifeUpsEnabled: boolean;
}
