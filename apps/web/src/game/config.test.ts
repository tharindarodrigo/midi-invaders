import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    AUTO: 0,
    Scene: class {},
    Scale: {
      FIT: 0,
      CENTER_BOTH: 0,
    },
  },
}));

import { SCENE_KEYS, resolveGameSizeForViewport } from '@/game/config';

describe('game config', () => {
  it('keeps all MVP scene keys in order', () => {
    expect(SCENE_KEYS).toEqual(['BootScene', 'MenuScene', 'GameScene', 'GameOverScene']);
  });

  it('uses portrait mobile sizing preset for narrow viewports', () => {
    expect(resolveGameSizeForViewport(390, 844)).toEqual({ width: 800, height: 1120 });
  });

  it('uses landscape mobile sizing preset for short mobile viewports', () => {
    expect(resolveGameSizeForViewport(844, 390)).toEqual({ width: 960, height: 640 });
  });

  it('keeps desktop sizing formula for wider screens', () => {
    expect(resolveGameSizeForViewport(1440, 900)).toEqual({ width: 1350, height: 844 });
  });
});
