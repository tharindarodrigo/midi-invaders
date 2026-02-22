import Phaser from 'phaser';
import { BootScene } from '@/game/scenes/BootScene';
import { MenuScene } from '@/game/scenes/MenuScene';
import { GameScene } from '@/game/scenes/GameScene';
import { GameOverScene } from '@/game/scenes/GameOverScene';
export { SCENE_KEYS } from '@/game/sceneKeys';

const resolveGameSize = (): { width: number; height: number } => {
  if (typeof window === 'undefined') {
    return { width: 1080, height: 1080 };
  }

  const minSquare = 1080;
  const verticalPadding = 48;
  const byHeight = Math.max(minSquare, Math.floor(window.innerHeight - verticalPadding));

  return { width: byHeight, height: byHeight };
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
