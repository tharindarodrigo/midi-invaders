import Phaser from 'phaser';
import { gameBridge } from '@/game/gameBridge';

export class MenuScene extends Phaser.Scene {
  private unsubscribe?: () => void;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0f172a');
    this.add.text(24, 24, 'MIDI Invaders', {
      color: '#f8fafc',
      fontSize: '36px',
      fontFamily: 'monospace',
    });
    this.add.text(24, 76, 'Use the overlay Start button to begin.', {
      color: '#cbd5e1',
      fontSize: '18px',
      fontFamily: 'monospace',
    });

    gameBridge.publishHud({
      score: 0,
      lifeScore: 0,
      lives: 3,
      wave: 1,
      activeInvaders: 0,
      scene: 'menu',
    });

    this.unsubscribe = gameBridge.onCommand((command) => {
      if (command.type === 'start') {
        this.scene.start('GameScene', { difficulty: command.difficulty });
      }
    });
  }

  shutdown(): void {
    this.unsubscribe?.();
  }
}
