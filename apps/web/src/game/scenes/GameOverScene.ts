import Phaser from 'phaser';
import { gameBridge } from '@/game/gameBridge';

export class GameOverScene extends Phaser.Scene {
  private unsubscribe?: () => void;

  constructor() {
    super('GameOverScene');
  }

  create(data: { score?: number }): void {
    const score = data.score ?? 0;
    this.cameras.main.setBackgroundColor('#111827');
    this.add.text(24, 24, 'Game Over', {
      color: '#f8fafc',
      fontSize: '36px',
      fontFamily: 'monospace',
    });
    this.add.text(24, 76, `Final score: ${score}`, {
      color: '#cbd5e1',
      fontSize: '18px',
      fontFamily: 'monospace',
    });
    this.add.text(24, 110, 'Use Restart in overlay to play again.', {
      color: '#cbd5e1',
      fontSize: '18px',
      fontFamily: 'monospace',
    });

    gameBridge.publishHud({
      score,
      lifeScore: 0,
      lives: 0,
      wave: 0,
      activeInvaders: 0,
      scene: 'game-over',
      mode: 'arcade',
      infiniteLives: false,
      lifeUpsEnabled: true,
    });

    this.unsubscribe = gameBridge.onCommand((command) => {
      if (command.type === 'restart' || command.type === 'start') {
        this.scene.start('GameScene', { settings: command.settings });
      }
    });
  }

  shutdown(): void {
    this.unsubscribe?.();
  }
}
