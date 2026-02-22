export interface HudState {
  score: number;
  lives: number;
  wave: number;
  activeInvaders: number;
  scene: 'menu' | 'game' | 'game-over';
}
