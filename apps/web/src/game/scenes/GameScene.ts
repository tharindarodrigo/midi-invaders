import Phaser from 'phaser';
import { createArenaConfig } from '@/game/arenaConfig';
import { gameBridge } from '@/game/gameBridge';
import { GameStateSystem } from '@/game/systems/gameStateSystem';
import { noteNumberToName } from '@/services/note';
import type { DifficultyLevel } from '@/types/gameplay';
import type { InputNoteEvent } from '@/types/input';

interface InvaderView {
  container: Phaser.GameObjects.Container;
}

export class GameScene extends Phaser.Scene {
  private arenaConfig = createArenaConfig();
  private gameState!: GameStateSystem;
  private readonly invaderViews = new Map<string, InvaderView>();
  private readonly laserViews = new Map<string, Phaser.GameObjects.Line>();
  private unsubscribeCommand?: () => void;
  private unsubscribeInput?: () => void;
  private isEnding = false;

  constructor() {
    super('GameScene');
  }

  create(data: { difficulty?: DifficultyLevel }): void {
    const difficulty = data.difficulty ?? 1;
    this.arenaConfig = createArenaConfig(this.scale.width, this.scale.height, difficulty);
    this.cameras.main.setBackgroundColor('#030712');
    this.gameState = new GameStateSystem(this.arenaConfig);
    this.gameState.reset(this.time.now);
    this.isEnding = false;

    this.drawArena();
    this.renderInitialInvaders();

    this.unsubscribeCommand = gameBridge.onCommand((command) => {
      if (command.type === 'end') {
        this.finishGame();
      }
      if (command.type === 'restart') {
        this.scene.start('GameScene', { difficulty: command.difficulty });
      }
    });

    this.unsubscribeInput = gameBridge.onInput((event) => {
      if (event.type === 'note_on') {
        this.handleNoteOn(event);
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());

    this.publishHud();
  }

  update(time: number, delta: number): void {
    if (this.isEnding) {
      return;
    }

    const step = this.gameState.step(time, delta);

    for (const invader of step.spawned) {
      this.renderInvader(invader.id, invader.note, invader.x, invader.y);
    }

    for (const invader of step.reachedCore) {
      this.destroyInvaderView(invader.id);
      this.playCoreImpact();
    }

    for (const laserId of step.expiredLaserIds) {
      this.destroyLaserView(laserId);
    }

    const state = this.gameState.getState();
    for (const invader of state.invaders) {
      const view = this.invaderViews.get(invader.id);
      if (!view) {
        continue;
      }

      view.container.setPosition(invader.x, invader.y);
    }

    if (step.gameOver) {
      this.finishGame();
      return;
    }

    this.publishHud();
  }

  private handleNoteOn(event: InputNoteEvent): void {
    if (this.isEnding) {
      return;
    }

    const result = this.gameState.processNote(event.note, this.time.now);

    if (result.kind === 'cooldown') {
      this.publishHud();
      return;
    }

    if (result.kind === 'miss') {
      this.playMissPulse();
      this.publishHud();
      return;
    }

    if (result.target) {
      this.playHitFlash(result.target.x, result.target.y);
      this.destroyInvaderView(result.target.id);
    }

    if (result.laser) {
      this.renderLaser(result.laser.id, result.laser.fromX, result.laser.fromY, result.laser.toX, result.laser.toY);
    }

    this.publishHud();
  }

  private drawArena(): void {
    const { centerX, centerY, coreRadius, spawnRadius } = this.arenaConfig;

    const spawnRing = this.add.circle(centerX, centerY, spawnRadius, 0x0b1220, 0.06);
    spawnRing.setStrokeStyle(1, 0x1e293b, 0.9);

    const coreRing = this.add.circle(centerX, centerY, coreRadius, 0x0891b2, 0.12);
    coreRing.setStrokeStyle(2, 0x22d3ee, 0.8);

    const turretOuter = this.add.circle(centerX, centerY, 18, 0x0f172a, 1);
    turretOuter.setStrokeStyle(2, 0xf59e0b, 1);

    this.add.circle(centerX, centerY, 8, 0xfacc15, 1);
  }

  private renderInitialInvaders(): void {
    const state = this.gameState.getState();
    for (const invader of state.invaders) {
      this.renderInvader(invader.id, invader.note, invader.x, invader.y);
    }
  }

  private renderInvader(id: string, note: number, x: number, y: number): void {
    const noteName = noteNumberToName(note);
    const hasSharp = noteName.includes('#');
    const noteIndex = note % 12;
    const noteStepOffsets = [0, 0, -8, -8, -16, -16, -24, -24, -32, -32, -40, -40];
    const noteY = noteStepOffsets[noteIndex];

    const parts: Phaser.GameObjects.GameObject[] = [];

    for (let i = 0; i < 5; i += 1) {
      const yOffset = -20 + i * 10;
      const line = this.add.rectangle(0, yOffset, 64, 1.6, 0x93c5fd, 0.45);
      parts.push(line);
    }

    const noteHead = this.add.ellipse(0, noteY, 16, 12, 0xf8fafc, 0.95);
    const stem = this.add.rectangle(8, noteY - 11, 2, 24, 0xf8fafc, 0.95);
    parts.push(noteHead, stem);

    if (hasSharp) {
      const accidental = this.add
        .text(-16, noteY - 6, '#', {
          color: '#fde68a',
          fontSize: '14px',
          fontFamily: 'monospace',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      parts.push(accidental);
    }

    const glow = this.add.circle(0, 0, 36, 0x38bdf8, 0.12);
    parts.push(glow);

    const label = this.add
      .text(0, 28, noteName, {
        color: '#e2e8f0',
        fontSize: '12px',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    parts.push(label);

    const container = this.add.container(x, y, parts);
    this.invaderViews.set(id, { container });

    this.tweens.add({
      targets: container,
      scaleX: { from: 0.9, to: 1 },
      scaleY: { from: 0.9, to: 1 },
      duration: 180,
      ease: 'Quad.Out',
    });
  }

  private renderLaser(id: string, fromX: number, fromY: number, toX: number, toY: number): void {
    const line = this.add.line(0, 0, fromX, fromY, toX, toY, 0x22d3ee, 1).setOrigin(0, 0);
    line.setLineWidth(2, 5);
    line.setBlendMode(Phaser.BlendModes.ADD);

    this.laserViews.set(id, line);

    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 120,
      ease: 'Linear',
    });
  }

  private destroyInvaderView(invaderId: string): void {
    const view = this.invaderViews.get(invaderId);
    if (!view) {
      return;
    }

    view.container.destroy(true);
    this.invaderViews.delete(invaderId);
  }

  private destroyLaserView(laserId: string): void {
    const line = this.laserViews.get(laserId);
    if (!line) {
      return;
    }

    line.destroy();
    this.laserViews.delete(laserId);
  }

  private playMissPulse(): void {
    const pulse = this.add.circle(this.arenaConfig.centerX, this.arenaConfig.centerY, this.arenaConfig.coreRadius, 0xef4444, 0.25);
    pulse.setStrokeStyle(2, 0xef4444, 0.85);

    this.tweens.add({
      targets: pulse,
      scaleX: 1.18,
      scaleY: 1.18,
      alpha: 0,
      duration: 180,
      ease: 'Quad.Out',
      onComplete: () => pulse.destroy(),
    });
  }

  private playCoreImpact(): void {
    const impact = this.add.circle(this.arenaConfig.centerX, this.arenaConfig.centerY, this.arenaConfig.coreRadius + 8, 0xf97316, 0.35);
    impact.setStrokeStyle(3, 0xfb7185, 0.9);

    this.tweens.add({
      targets: impact,
      alpha: 0,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => impact.destroy(),
    });
  }

  private playHitFlash(x: number, y: number): void {
    const flash = this.add.circle(x, y, 14, 0xffffff, 0.9).setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: flash,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration: 140,
      ease: 'Quad.Out',
      onComplete: () => flash.destroy(),
    });
  }

  private publishHud(): void {
    const state = this.gameState.getState();
    gameBridge.publishHud({
      score: state.score,
      lives: state.lives,
      wave: state.wave,
      weaponCooldownMs: Math.max(0, Math.ceil(state.weaponCooldownUntil - this.time.now)),
      activeInvaders: state.invaders.length,
      scene: 'game',
    });
  }

  private finishGame(): void {
    if (this.isEnding) {
      return;
    }

    this.isEnding = true;
    this.scene.start('GameOverScene', { score: this.gameState.getState().score });
  }

  private cleanup(): void {
    this.unsubscribeCommand?.();
    this.unsubscribeCommand = undefined;
    this.unsubscribeInput?.();
    this.unsubscribeInput = undefined;

    for (const invaderId of this.invaderViews.keys()) {
      this.destroyInvaderView(invaderId);
    }

    for (const laserId of this.laserViews.keys()) {
      this.destroyLaserView(laserId);
    }
  }
}
