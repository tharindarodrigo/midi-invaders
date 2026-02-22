export interface HudState {
  score: number;
  lives: number;
  wave: number;
  weaponCooldownMs: number;
  activeInvaders: number;
  scene: 'menu' | 'game' | 'game-over';
}
