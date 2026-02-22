import Phaser from 'phaser';
import { createArenaConfig } from '@/game/arenaConfig';
import { gameBridge } from '@/game/gameBridge';
import { GameStateSystem } from '@/game/systems/gameStateSystem';
import { renderStaffNoteToCanvas } from '@/services/notation';
import type { DifficultyLevel } from '@/types/gameplay';
import type { InputNoteEvent } from '@/types/input';

interface InvaderView {
  container: Phaser.GameObjects.Container;
}

const NOTATION_TEXTURE_WIDTH = 220;
const NOTATION_TEXTURE_HEIGHT = 160;
const NOTATION_TEXTURE_VERSION = 'v6-stem-direction';
const NOTATION_SCALE = 1.2;
const NOTATION_BASE_DISPLAY_WIDTH = 160;
const NOTATION_BASE_DISPLAY_HEIGHT = 122;
const NOTATION_DISPLAY_WIDTH = Math.round(NOTATION_BASE_DISPLAY_WIDTH * NOTATION_SCALE);
const NOTATION_DISPLAY_HEIGHT = Math.round(NOTATION_BASE_DISPLAY_HEIGHT * NOTATION_SCALE);
const INVADER_FRAME_WIDTH = NOTATION_DISPLAY_WIDTH + 20;
const INVADER_FRAME_HEIGHT = NOTATION_DISPLAY_HEIGHT + 30;
const NOTATION_VERTICAL_OFFSET = -Math.round(INVADER_FRAME_HEIGHT * 0.15);
const SCORE_POPUP_DURATION_MS = 620;
const SCORE_POPUP_RISE_PX = 54;
const MISS_FREEZE_MS = 1000;

export class GameScene extends Phaser.Scene {
  private arenaConfig = createArenaConfig();
  private gameState!: GameStateSystem;
  private readonly invaderViews = new Map<string, InvaderView>();
  private readonly laserViews = new Map<string, Phaser.GameObjects.Line>();
  private unsubscribeCommand?: () => void;
  private unsubscribeInput?: () => void;
  private isEnding = false;
  private freezeUntil = 0;
  private freezeDurationPendingMs = 0;

  constructor() {
    super('GameScene');
  }

  create(data: { difficulty?: DifficultyLevel }): void {
    const difficulty = data.difficulty ?? 1;
    this.arenaConfig = createArenaConfig(this.scale.width, this.scale.height, difficulty);
    this.cameras.main.setBackgroundColor('#030712');
    this.cameras.main.roundPixels = true;
    this.gameState = new GameStateSystem(this.arenaConfig);
    this.gameState.reset(this.time.now);
    this.isEnding = false;
    this.freezeUntil = 0;
    this.freezeDurationPendingMs = 0;

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

    if (time < this.freezeUntil) {
      this.publishHud();
      return;
    }

    this.applyPendingFreezeDelay();

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

      view.container.setPosition(Math.round(invader.x), Math.round(invader.y));
    }

    if (step.gameOver) {
      this.finishGame();
      return;
    }

    this.publishHud();
  }

  private handleNoteOn(event: InputNoteEvent): void {
    if (this.isEnding || this.time.now < this.freezeUntil) {
      return;
    }

    this.applyPendingFreezeDelay();

    const result = this.gameState.processNote(event.note, this.time.now);

    if (result.kind === 'ignored') {
      this.publishHud();
      return;
    }

    if (result.kind === 'miss') {
      this.playMissPulse();
      this.playScorePopup(this.arenaConfig.centerX, this.arenaConfig.centerY, result.scoreDelta);
      this.freezeForMs(MISS_FREEZE_MS);
      this.publishHud();
      return;
    }

    if (result.target) {
      this.playHitFlash(result.target.x, result.target.y);
      this.playScorePopup(result.target.x, result.target.y, result.scoreDelta);
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
    const notationTextureKey = this.ensureNotationTexture(note);

    const halo = this.add.circle(0, 0, 98, 0x22d3ee, 0.1);
    const notationFrame = this.add.rectangle(0, 0, INVADER_FRAME_WIDTH, INVADER_FRAME_HEIGHT, 0x020617, 0.8);
    notationFrame.setStrokeStyle(2, 0x22d3ee, 0.9);

    const notationSprite = this.add.image(
      0,
      NOTATION_VERTICAL_OFFSET,
      notationTextureKey === '__MISSING' ? '__WHITE' : notationTextureKey,
    );
    if (notationTextureKey === '__MISSING') {
      notationSprite.setTint(0x94a3b8);
    }
    notationSprite.setDisplaySize(NOTATION_DISPLAY_WIDTH, NOTATION_DISPLAY_HEIGHT);

    const container = this.add.container(x, y, [halo, notationFrame, notationSprite]);
    this.invaderViews.set(id, { container });
  }

  private ensureNotationTexture(note: number): string {
    const textureKey = `staff-note-${NOTATION_TEXTURE_VERSION}-${note}`;
    if (this.textures.exists(textureKey)) {
      return textureKey;
    }

    const canvasTexture = this.textures.createCanvas(
      textureKey,
      NOTATION_TEXTURE_WIDTH,
      NOTATION_TEXTURE_HEIGHT,
    );
    if (!canvasTexture) {
      return '__MISSING';
    }

    const canvas = canvasTexture.getCanvas();
    renderStaffNoteToCanvas(canvas, note, { clef: 'treble' });
    canvasTexture.refresh();

    return textureKey;
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

  private playScorePopup(x: number, y: number, scoreDelta: number): void {
    if (scoreDelta === 0) {
      return;
    }

    const isPenalty = scoreDelta < 0;
    const text = scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`;
    const startY = y - 20;
    const popup = this.add.text(x, startY, text, {
      color: isPenalty ? '#fb7185' : '#facc15',
      fontSize: '30px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: isPenalty ? '#4c0519' : '#7c2d12',
      strokeThickness: 6,
    });

    popup.setOrigin(0.5);
    popup.setDepth(20);
    popup.setAlpha(0);
    popup.setScale(0.72);

    this.tweens.add({
      targets: popup,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: isPenalty ? startY - 2 : startY - 10,
      duration: 120,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: popup,
          y: startY - (isPenalty ? SCORE_POPUP_RISE_PX - 12 : SCORE_POPUP_RISE_PX),
          alpha: 0,
          scaleX: 0.92,
          scaleY: 0.92,
          duration: SCORE_POPUP_DURATION_MS,
          ease: 'Cubic.Out',
          onComplete: () => popup.destroy(),
        });
      },
    });
  }

  private freezeForMs(durationMs: number): void {
    if (durationMs <= 0) {
      return;
    }

    this.freezeUntil = this.time.now + durationMs;
    this.freezeDurationPendingMs += durationMs;
    this.cameras.main.shake(120, 0.0035, true);
  }

  private applyPendingFreezeDelay(): void {
    if (this.freezeDurationPendingMs <= 0) {
      return;
    }

    this.gameState.delayTimersForFreeze(this.freezeDurationPendingMs);
    this.freezeDurationPendingMs = 0;
  }

  private publishHud(): void {
    const state = this.gameState.getState();
    gameBridge.publishHud({
      score: state.score,
      lives: state.lives,
      wave: state.wave,
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
