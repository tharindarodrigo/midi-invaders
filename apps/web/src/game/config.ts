import Phaser from 'phaser';
import { BootScene } from '@/game/scenes/BootScene';
import { MenuScene } from '@/game/scenes/MenuScene';
import { GameScene } from '@/game/scenes/GameScene';
import { GameOverScene } from '@/game/scenes/GameOverScene';
export { SCENE_KEYS } from '@/game/sceneKeys';

const MOBILE_BREAKPOINT_PX = 900;
const MOBILE_VERTICAL_PADDING = 56;
const MOBILE_PORTRAIT_SIZE = {
  width: 800,
  height: 1120,
};
const MOBILE_LANDSCAPE_SIZE = {
  width: 960,
  height: 640,
};

export const resolveGameSizeForViewport = (
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } => {
  const width = Math.max(0, Math.floor(viewportWidth));
  const height = Math.max(0, Math.floor(viewportHeight));

  if (width <= MOBILE_BREAKPOINT_PX) {
    const isPortrait = width < height - MOBILE_VERTICAL_PADDING;
    return isPortrait ? MOBILE_PORTRAIT_SIZE : MOBILE_LANDSCAPE_SIZE;
  }

  const minHeight = 760;
  const verticalPadding = 56;
  const byHeight = Math.max(minHeight, Math.floor(height - verticalPadding));
  const widthByAspect = Math.floor(byHeight * 1.6);

  return { width: widthByAspect, height: byHeight };
};

const resolveGameSize = (): { width: number; height: number } => {
  if (typeof window === 'undefined') {
    return { width: 1728, height: 1080 };
  }

  return resolveGameSizeForViewport(window.innerWidth, window.innerHeight);
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
