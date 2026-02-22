import Phaser from 'phaser';
import { BootScene } from '@/game/scenes/BootScene';
import { MenuScene } from '@/game/scenes/MenuScene';
import { GameScene } from '@/game/scenes/GameScene';
import { GameOverScene } from '@/game/scenes/GameOverScene';
export { SCENE_KEYS } from '@/game/sceneKeys';

const resolveGameSize = (): { width: number; height: number } => {
  if (typeof window === 'undefined') {
    return { width: 1400, height: 900 };
  }

  const width = Math.min(1500, Math.max(1100, Math.floor(window.innerWidth * 0.78)));
  const height = Math.min(980, Math.max(760, Math.floor(window.innerHeight * 0.84)));

  return { width, height };
};

export const createGameConfig = (container: string): Phaser.Types.Core.GameConfig => ({
  ...resolveGameSize(),
  type: Phaser.AUTO,
  parent: container,
  backgroundColor: '#020617',
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
  physics: {
    default: 'arcade',
  },
});
