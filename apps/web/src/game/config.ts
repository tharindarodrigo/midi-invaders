import Phaser from 'phaser';
import { BootScene } from '@/game/scenes/BootScene';
import { MenuScene } from '@/game/scenes/MenuScene';
import { GameScene } from '@/game/scenes/GameScene';
import { GameOverScene } from '@/game/scenes/GameOverScene';
export { SCENE_KEYS } from '@/game/sceneKeys';

const resolveGameSize = (): { width: number; height: number } => {
  if (typeof window === 'undefined') {
    return { width: 1728, height: 1080 };
  }

  const minHeight = 760;
  const verticalPadding = 56;
  const byHeight = Math.max(minHeight, Math.floor(window.innerHeight - verticalPadding));
  const widthByAspect = Math.floor(byHeight * 1.6);

  return { width: widthByAspect, height: byHeight };
};

export const createGameConfig = (container: string): Phaser.Types.Core.GameConfig => ({
  ...resolveGameSize(),
  type: Phaser.AUTO,
  parent: container,
  backgroundColor: '#020617',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
  physics: {
    default: 'arcade',
  },
});
