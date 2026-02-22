import { describe, expect, it } from 'vitest';
import { SCENE_KEYS } from '@/game/sceneKeys';

describe('scene registration', () => {
  it('keeps all MVP scene keys in order', () => {
    expect(SCENE_KEYS).toEqual(['BootScene', 'MenuScene', 'GameScene', 'GameOverScene']);
  });
});
