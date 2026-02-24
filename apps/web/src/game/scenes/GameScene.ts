import Phaser from 'phaser';
import { createArenaConfig } from '@/game/arenaConfig';
import { gameBridge } from '@/game/gameBridge';
import { resolveInvaderClef, type StaffClef } from '@/game/notationProfile';
import { GameStateSystem } from '@/game/systems/gameStateSystem';
import { PromptScheduler } from '@/game/systems/promptScheduler';
import { InvaderPromptSynth } from '@/services/invaderPromptSynth';
import { renderStaffNoteToCanvas, type StaffRenderPalette } from '@/services/notation';
import {
  DEFAULT_GAMEPLAY_SETTINGS,
  normalizeGameplaySettings,
} from '@/types/gameplay';
import type { GameplaySettings, InvaderEntity } from '@/types/gameplay';
import type { InputNoteEvent } from '@/types/input';

interface InvaderView {
  container: Phaser.GameObjects.Container;
  shell: Phaser.GameObjects.Arc;
}

interface LaserView {
  glow: Phaser.GameObjects.Line;
  core: Phaser.GameObjects.Line;
  muzzleFlash: Phaser.GameObjects.Arc;
}

interface PlayedNoteDisplay {
  container: Phaser.GameObjects.Container;
  panel: Phaser.GameObjects.Arc;
  noteSprite: Phaser.GameObjects.Image;
  statusText: Phaser.GameObjects.Text;
}

const NOTATION_TEXTURE_WIDTH = 220;
const NOTATION_TEXTURE_HEIGHT = 160;
const NOTATION_TEXTURE_VERSION = 'v12-staff-larger';
const NOTATION_SCALE = 1.32;
const NOTATION_BASE_DISPLAY_WIDTH = 144;
const NOTATION_BASE_DISPLAY_HEIGHT = 112;
const NOTATION_DISPLAY_WIDTH = Math.round(NOTATION_BASE_DISPLAY_WIDTH * NOTATION_SCALE);
const NOTATION_DISPLAY_HEIGHT = Math.round(NOTATION_BASE_DISPLAY_HEIGHT * NOTATION_SCALE);
const INVADER_BODY_RADIUS = Math.round(Math.max(NOTATION_DISPLAY_WIDTH, NOTATION_DISPLAY_HEIGHT) * 0.5);
const INVADER_INNER_RING_RADIUS = INVADER_BODY_RADIUS - 8;
const INVADER_HALO_RADIUS = INVADER_BODY_RADIUS + 18;
const NOTATION_IN_BODY_SCALE = 0.98;
const NOTATION_IN_BODY_WIDTH = Math.round(NOTATION_DISPLAY_WIDTH * NOTATION_IN_BODY_SCALE);
const NOTATION_IN_BODY_HEIGHT = Math.round(NOTATION_DISPLAY_HEIGHT * NOTATION_IN_BODY_SCALE);
const NOTATION_VERTICAL_OFFSET = 0;
const SCORE_POPUP_DURATION_MS = 620;
const SCORE_POPUP_RISE_PX = 54;
const MISS_FREEZE_MS = 1000;
const LASER_TRAVEL_DURATION_MS = 85;
const LASER_FADE_DURATION_MS = 35;
const POWER_UP_PULSE_DURATION_MS = 540;
const PROMPT_NOTE_DURATION_MS = 280;
const PROMPT_NOTE_GAP_MS = 120;
const PITCH_GLOW_DURATION_MS = 220;
const PITCH_GLOW_COLOR = 0xa855f7;
const PLAYED_NOTE_TEXTURE_WIDTH = 300;
const PLAYED_NOTE_TEXTURE_HEIGHT = 210;
const PLAYED_NOTE_TEXTURE_VERSION = 'v1-played-note-center';
const PLAYED_NOTE_DISPLAY_WIDTH = Math.round(186 * 1.1);
const PLAYED_NOTE_DISPLAY_HEIGHT = Math.round(136 * 1.1);
const PLAYED_NOTE_PANEL_RADIUS = 124;
const PLAYED_NOTE_PANEL_INNER_RADIUS = 108;
const PLAYED_NOTE_FLOAT_PX = 6;
const PLAYED_NOTE_BOB_DURATION_MS = 1100;
const INVADER_STAFF_INSET_X = 34;
const PLAYED_STAFF_INSET_X = 86;
const PLAYED_NOTE_CORRECT_PALETTE: Partial<StaffRenderPalette> = {
  staffColor: '#22d3ee',
  noteColor: '#a3e635',
  accidentalColor: '#f472b6',
  gradientStart: '#22d3ee',
  gradientMiddle: '#a3e635',
  gradientEnd: '#f472b6',
};
const PLAYED_NOTE_WRONG_PALETTE: Partial<StaffRenderPalette> = {
  staffColor: '#fca5a5',
  noteColor: '#ef4444',
  accidentalColor: '#fb7185',
  gradientStart: '#fca5a5',
  gradientMiddle: '#ef4444',
  gradientEnd: '#be123c',
};

export class GameScene extends Phaser.Scene {
  private arenaConfig = createArenaConfig();
  private gameState!: GameStateSystem;
  private promptScheduler: PromptScheduler | null = null;
  private readonly promptSynth = new InvaderPromptSynth();
  private readonly invaderViews = new Map<string, InvaderView>();
  private readonly laserViews = new Map<string, LaserView>();
  private unsubscribeCommand?: () => void;
  private unsubscribeInput?: () => void;
  private isEnding = false;
  private freezeUntil = 0;
  private freezeDurationPendingMs = 0;
  private microphoneSuppressed = false;
  private playedNoteDisplay: PlayedNoteDisplay | null = null;
  private playedNoteBaseY = 0;

  constructor() {
    super('GameScene');
  }

  create(data: { settings?: GameplaySettings }): void {
    const gameplaySettings = normalizeGameplaySettings(data.settings ?? DEFAULT_GAMEPLAY_SETTINGS);
    this.arenaConfig = createArenaConfig(
      this.scale.width,
      this.scale.height,
      gameplaySettings.difficulty,
      gameplaySettings,
    );
    this.cameras.main.setBackgroundColor('#030712');
    this.cameras.main.roundPixels = true;
    this.gameState = new GameStateSystem(this.arenaConfig);
    this.gameState.reset(this.time.now);
    this.promptScheduler =
      this.arenaConfig.mode === 'pitch'
        ? new PromptScheduler(this.arenaConfig.promptRepeatMs)
        : null;
    this.promptSynth.stop();
    this.isEnding = false;
    this.freezeUntil = 0;
    this.freezeDurationPendingMs = 0;
    this.setMicrophoneSuppression(false);

    this.drawArena();
    this.createPlayedNoteDisplay();
    this.renderInitialInvaders();
    this.syncPitchPrompts(this.gameState.getState().invaders, this.time.now);

    this.unsubscribeCommand = gameBridge.onCommand((command) => {
      if (command.type === 'end') {
        this.finishGame();
      }
      if (command.type === 'restart') {
        this.scene.start('GameScene', { settings: command.settings });
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
      this.renderInvader(invader);
    }

    for (const invader of step.reachedCore) {
      this.destroyInvaderView(invader.id);
      this.playCoreImpact();
    }

    for (const laserId of step.expiredLaserIds) {
      this.destroyLaserView(laserId);
    }

    const state = this.gameState.getState();
    this.syncPitchPrompts(state.invaders, time);

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

    this.maybePlayPitchPrompt(time);
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
      this.renderPlayedNote(event.note, false);
      this.playMissPulse();
      this.playScorePopup(this.arenaConfig.centerX, this.arenaConfig.centerY, result.scoreDelta);
      this.freezeForMs(MISS_FREEZE_MS);
      this.publishHud();
      return;
    }

    if (result.kind === 'progress') {
      this.renderPlayedNote(event.note, true);
      if (this.arenaConfig.mode === 'pitch' && result.target) {
        this.playPitchPromptGlow(result.target.id);
      }
      this.publishHud();
      return;
    }

    const hitX = result.target?.x;
    const hitY = result.target?.y;

    if (result.target) {
      this.playScorePopup(result.target.x, result.target.y, result.scoreDelta);
      this.destroyInvaderView(result.target.id);
    }

    if (result.laser) {
      this.renderLaser(
        result.laser.id,
        result.laser.fromX,
        result.laser.fromY,
        result.laser.toX,
        result.laser.toY,
        () => {
          if (hitX !== undefined && hitY !== undefined) {
            this.playHitFlash(hitX, hitY);
          }
        },
      );
    } else if (hitX !== undefined && hitY !== undefined) {
      this.playHitFlash(hitX, hitY);
    }

    if (result.powerUp.activated) {
      if (this.arenaConfig.mode === 'pitch') {
        for (const invader of result.powerUp.destroyedInvaders) {
          this.promptSynth.stopInvader(invader.id);
          this.promptScheduler?.clearInvader(invader.id);
        }
      }
      this.playPowerUpPulse(result.powerUp.destroyedInvaders);
    }

    this.renderPlayedNote(event.note, true);
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

  private createPlayedNoteDisplay(): void {
    // Keep this circular and below invaders so crossings remain readable.
    const panelGlow = this.add.circle(0, 0, PLAYED_NOTE_PANEL_RADIUS + 20, 0x0f172a, 0.3);
    panelGlow.setStrokeStyle(2, 0x22d3ee, 0.2);
    panelGlow.setBlendMode(Phaser.BlendModes.ADD);

    const panel = this.add.circle(0, 0, PLAYED_NOTE_PANEL_RADIUS, 0x020617, 0.76);
    panel.setStrokeStyle(2, 0x22d3ee, 0.86);

    const innerRing = this.add.circle(0, 0, PLAYED_NOTE_PANEL_INNER_RADIUS, 0x0b1220, 0.34);
    innerRing.setStrokeStyle(1, 0x38bdf8, 0.72);

    const titleText = this.add.text(0, -PLAYED_NOTE_PANEL_RADIUS + 22, 'Last Played', {
      color: '#e2e8f0',
      fontSize: '20px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#0f172a',
      strokeThickness: 4,
    });
    titleText.setOrigin(0.5);

    const noteSprite = this.add.image(0, 2, '__WHITE');
    noteSprite.setDisplaySize(PLAYED_NOTE_DISPLAY_WIDTH, PLAYED_NOTE_DISPLAY_HEIGHT);
    noteSprite.setVisible(false);

    const statusText = this.add.text(0, PLAYED_NOTE_PANEL_RADIUS - 22, 'Play a note', {
      color: '#93c5fd',
      fontSize: '17px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#0f172a',
      strokeThickness: 4,
    });
    statusText.setOrigin(0.5);

    const container = this.add.container(this.arenaConfig.centerX, this.arenaConfig.centerY, [
      panelGlow,
      panel,
      innerRing,
      titleText,
      noteSprite,
      statusText,
    ]);
    container.setDepth(0);

    this.playedNoteDisplay = {
      container,
      panel,
      noteSprite,
      statusText,
    };
    this.playedNoteBaseY = this.arenaConfig.centerY;

    this.tweens.add({
      targets: container,
      y: this.playedNoteBaseY - PLAYED_NOTE_FLOAT_PX,
      duration: PLAYED_NOTE_BOB_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private renderPlayedNote(note: number, wasCorrect: boolean): void {
    const display = this.playedNoteDisplay;
    if (!display) {
      return;
    }

    const clef = resolveInvaderClef(this.arenaConfig.clefMode, note, `played-note-${note}`);
    const textureKey = this.ensurePlayedNoteTexture(note, clef, wasCorrect);
    display.noteSprite.setVisible(true);
    display.noteSprite.setScale(0.9);

    if (textureKey === '__MISSING') {
      display.noteSprite.setTexture('__WHITE');
      display.noteSprite.setTint(wasCorrect ? 0x86efac : 0xfca5a5);
    } else {
      display.noteSprite.setTexture(textureKey);
      display.noteSprite.clearTint();
    }

    display.panel.setStrokeStyle(2, wasCorrect ? 0x22d3ee : 0xef4444, wasCorrect ? 0.86 : 0.98);
    display.statusText.setText(wasCorrect ? 'Correct note' : 'Wrong note');
    display.statusText.setColor(wasCorrect ? '#86efac' : '#fca5a5');

    this.tweens.killTweensOf(display.noteSprite);
    this.tweens.add({
      targets: display.noteSprite,
      scaleX: 1,
      scaleY: 1,
      duration: 160,
      ease: 'Back.Out',
    });

    if (!wasCorrect) {
      display.container.x = this.arenaConfig.centerX;
      this.tweens.add({
        targets: display.container,
        x: this.arenaConfig.centerX + 4,
        duration: 44,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.InOut',
      });
    }
  }

  private renderInitialInvaders(): void {
    const state = this.gameState.getState();
    for (const invader of state.invaders) {
      this.renderInvader(invader);
    }
  }

  private renderInvader(invader: InvaderEntity): void {
    const { id, note, x, y } = invader;

    const halo = this.add.circle(0, 0, INVADER_HALO_RADIUS, 0x22d3ee, 0.12);
    const shell = this.add.circle(0, 0, INVADER_BODY_RADIUS, 0x020617, 0.88);
    shell.setStrokeStyle(2, 0x22d3ee, 0.9);

    const innerRing = this.add.circle(0, 0, INVADER_INNER_RING_RADIUS, 0x0b1220, 0.32);
    innerRing.setStrokeStyle(1, 0x38bdf8, 0.72);

    const children: Phaser.GameObjects.GameObject[] = [halo, shell, innerRing];

    if (this.arenaConfig.mode === 'pitch') {
      const centerDot = this.add.circle(0, 0, 10, 0xddd6fe, 0.35);
      centerDot.setStrokeStyle(1, 0xc4b5fd, 0.65);
      children.push(centerDot);
    } else {
      const clef = resolveInvaderClef(this.arenaConfig.clefMode, note, id);
      const notationTextureKey = this.ensureNotationTexture(note, clef);
      const notationSprite = this.add.image(
        0,
        NOTATION_VERTICAL_OFFSET,
        notationTextureKey === '__MISSING' ? '__WHITE' : notationTextureKey,
      );
      if (notationTextureKey === '__MISSING') {
        notationSprite.setTint(0x94a3b8);
      }
      notationSprite.setDisplaySize(NOTATION_IN_BODY_WIDTH, NOTATION_IN_BODY_HEIGHT);
      children.push(notationSprite);
    }

    const container = this.add.container(x, y, children);
    this.invaderViews.set(id, { container, shell });
  }

  private ensureNotationTexture(note: number, clef: StaffClef): string {
    const textureKey = `staff-note-${NOTATION_TEXTURE_VERSION}-${clef}-${note}`;
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
    renderStaffNoteToCanvas(canvas, note, { clef, insetX: INVADER_STAFF_INSET_X });
    canvasTexture.refresh();

    return textureKey;
  }

  private ensurePlayedNoteTexture(note: number, clef: StaffClef, wasCorrect: boolean): string {
    const state = wasCorrect ? 'correct' : 'wrong';
    const textureKey = `staff-note-${PLAYED_NOTE_TEXTURE_VERSION}-${state}-${clef}-${note}`;
    if (this.textures.exists(textureKey)) {
      return textureKey;
    }

    const canvasTexture = this.textures.createCanvas(
      textureKey,
      PLAYED_NOTE_TEXTURE_WIDTH,
      PLAYED_NOTE_TEXTURE_HEIGHT,
    );
    if (!canvasTexture) {
      return '__MISSING';
    }

    const palette = wasCorrect ? PLAYED_NOTE_CORRECT_PALETTE : PLAYED_NOTE_WRONG_PALETTE;
    const canvas = canvasTexture.getCanvas();
    renderStaffNoteToCanvas(canvas, note, { clef, palette, insetX: PLAYED_STAFF_INSET_X });
    canvasTexture.refresh();

    return textureKey;
  }

  private renderLaser(
    id: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    onImpact?: () => void,
  ): void {
    const glow = this.add.line(0, 0, fromX, fromY, fromX, fromY, 0xff3040, 0.86).setOrigin(0, 0);
    glow.setLineWidth(16, 1.8);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setDepth(9);

    const core = this.add.line(0, 0, fromX, fromY, fromX, fromY, 0xfff3e8, 0.98).setOrigin(0, 0);
    core.setLineWidth(6, 1.2);
    core.setBlendMode(Phaser.BlendModes.ADD);
    core.setDepth(10);

    const muzzleFlash = this.add.circle(fromX, fromY, 8, 0xff6b6b, 0.96);
    muzzleFlash.setBlendMode(Phaser.BlendModes.ADD);
    muzzleFlash.setDepth(11);

    this.laserViews.set(id, { glow, core, muzzleFlash });

    const distance = Math.hypot(toX - fromX, toY - fromY) || 1;
    const directionX = (toX - fromX) / distance;
    const directionY = (toY - fromY) / distance;
    const glowTrailLength = Math.min(94, Math.max(30, distance * 0.32));
    const coreTrailLength = Math.min(58, Math.max(18, distance * 0.22));
    const travelState = { progress: 0 };

    const updateBeam = (progress: number): void => {
      const clamped = Phaser.Math.Clamp(progress, 0, 1);
      const headX = Phaser.Math.Linear(fromX, toX, clamped);
      const headY = Phaser.Math.Linear(fromY, toY, clamped);
      const travelledDistance = distance * clamped;
      const currentGlowTrail = Math.min(glowTrailLength, travelledDistance);
      const currentCoreTrail = Math.min(coreTrailLength, travelledDistance);
      const glowTailX = headX - directionX * currentGlowTrail;
      const glowTailY = headY - directionY * currentGlowTrail;
      const coreTailX = headX - directionX * currentCoreTrail;
      const coreTailY = headY - directionY * currentCoreTrail;

      glow.setTo(glowTailX, glowTailY, headX, headY);
      core.setTo(coreTailX, coreTailY, headX, headY);

      const glowStrength = 0.9 - clamped * 0.5;
      const coreStrength = 1 - clamped * 0.36;
      glow.setAlpha(Math.max(0.24, glowStrength));
      core.setAlpha(Math.max(0.42, coreStrength));
    };

    updateBeam(0);

    this.tweens.add({
      targets: travelState,
      progress: 1,
      duration: LASER_TRAVEL_DURATION_MS,
      ease: 'Cubic.Out',
      onUpdate: () => updateBeam(travelState.progress),
      onComplete: () => {
        onImpact?.();
        this.tweens.add({
          targets: [glow, core],
          alpha: 0,
          duration: LASER_FADE_DURATION_MS,
          ease: 'Quad.Out',
        });
      },
    });

    this.tweens.add({
      targets: muzzleFlash,
      alpha: 0,
      scaleX: 1.9,
      scaleY: 1.9,
      duration: LASER_TRAVEL_DURATION_MS + LASER_FADE_DURATION_MS,
      ease: 'Cubic.Out',
    });
  }

  private destroyInvaderView(invaderId: string): void {
    this.promptSynth.stopInvader(invaderId);
    this.promptScheduler?.clearInvader(invaderId);
    this.syncMicrophoneSuppressionFromScheduler();

    const view = this.invaderViews.get(invaderId);
    if (!view) {
      return;
    }

    view.container.destroy(true);
    this.invaderViews.delete(invaderId);
  }

  private destroyLaserView(laserId: string): void {
    const view = this.laserViews.get(laserId);
    if (!view) {
      return;
    }

    view.glow.destroy();
    view.core.destroy();
    view.muzzleFlash.destroy();
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

  private playPowerUpPulse(destroyedInvaders: InvaderEntity[]): void {
    const { centerX, centerY, coreRadius, spawnRadius } = this.arenaConfig;

    const waveStartRadius = coreRadius + 6;
    const waveEndRadius = spawnRadius + 36;
    const waveTravelDistance = Math.max(1, waveEndRadius - waveStartRadius);
    const wave = { radius: waveStartRadius, alpha: 0.96, lineWidth: 16 };

    const centerBurst = this.add.circle(centerX, centerY, coreRadius + 12, 0x4ade80, 0.52);
    centerBurst.setBlendMode(Phaser.BlendModes.ADD);
    centerBurst.setDepth(14);

    const waveHalo = this.add.graphics();
    waveHalo.setDepth(14);
    waveHalo.setBlendMode(Phaser.BlendModes.ADD);

    const waveFront = this.add.graphics();
    waveFront.setDepth(15);
    waveFront.setBlendMode(Phaser.BlendModes.ADD);

    const drawWave = (): void => {
      waveHalo.clear();
      waveHalo.lineStyle(wave.lineWidth * 2.2, 0x22c55e, wave.alpha * 0.28);
      waveHalo.strokeCircle(centerX, centerY, wave.radius);

      waveFront.clear();
      waveFront.lineStyle(wave.lineWidth, 0x86efac, wave.alpha);
      waveFront.strokeCircle(centerX, centerY, wave.radius);
    };

    drawWave();

    this.tweens.add({
      targets: centerBurst,
      scaleX: 2.8,
      scaleY: 2.8,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => centerBurst.destroy(),
    });

    this.tweens.add({
      targets: wave,
      radius: waveEndRadius,
      alpha: 0,
      lineWidth: 2,
      duration: POWER_UP_PULSE_DURATION_MS,
      ease: 'Cubic.Out',
      onUpdate: drawWave,
      onComplete: () => {
        waveHalo.destroy();
        waveFront.destroy();
      },
    });

    for (const invader of destroyedInvaders) {
      const distance = Math.hypot(invader.x - centerX, invader.y - centerY);
      const waveProgress = Phaser.Math.Clamp((distance - waveStartRadius) / waveTravelDistance, 0, 1);
      const delay = Math.round(waveProgress * POWER_UP_PULSE_DURATION_MS);

      this.time.delayedCall(delay, () => {
        this.playPowerUpHitFlash(invader.x, invader.y);
        this.destroyInvaderView(invader.id);
      });
    }
  }

  private playPowerUpHitFlash(x: number, y: number): void {
    const flash = this.add.circle(x, y, 16, 0x86efac, 0.95).setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: flash,
      scaleX: 2.1,
      scaleY: 2.1,
      alpha: 0,
      duration: 180,
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

    if (this.arenaConfig.mode === 'pitch') {
      this.promptSynth.stop();
      this.promptScheduler?.clearActivePrompt();
      this.syncMicrophoneSuppressionFromScheduler();
    }

    this.freezeUntil = this.time.now + durationMs;
    this.freezeDurationPendingMs += durationMs;
    this.cameras.main.shake(120, 0.0035, true);
  }

  private applyPendingFreezeDelay(): void {
    if (this.freezeDurationPendingMs <= 0) {
      return;
    }

    if (this.arenaConfig.mode === 'pitch') {
      this.promptSynth.stop();
      this.promptScheduler?.clearActivePrompt();
      this.promptScheduler?.delayAll(this.freezeDurationPendingMs);
      this.syncMicrophoneSuppressionFromScheduler();
    }

    this.gameState.delayTimersForFreeze(this.freezeDurationPendingMs);
    this.freezeDurationPendingMs = 0;
  }

  private publishHud(): void {
    const state = this.gameState.getState();
    gameBridge.publishHud({
      score: state.score,
      lifeScore: state.lifeScore,
      lives: state.lives,
      wave: state.wave,
      activeInvaders: state.invaders.length,
      scene: 'game',
      mode: this.arenaConfig.mode,
      infiniteLives: this.arenaConfig.infiniteLives,
      lifeUpsEnabled: this.arenaConfig.lifeUpsEnabled,
    });
  }

  private finishGame(): void {
    if (this.isEnding) {
      return;
    }

    this.isEnding = true;
    this.promptSynth.stop();
    this.promptScheduler?.clearActivePrompt();
    this.setMicrophoneSuppression(false);
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

    this.promptSynth.destroy();
    this.promptScheduler = null;
    this.playedNoteDisplay?.container.destroy(true);
    this.playedNoteDisplay = null;
    this.setMicrophoneSuppression(false);
  }

  private syncPitchPrompts(invaders: InvaderEntity[], now: number): void {
    if (this.arenaConfig.mode !== 'pitch') {
      return;
    }

    this.promptScheduler?.syncInvaders(
      invaders.map((invader) => invader.id),
      now,
    );
  }

  private maybePlayPitchPrompt(now: number): void {
    if (this.arenaConfig.mode !== 'pitch') {
      return;
    }

    const scheduler = this.promptScheduler;
    if (!scheduler) {
      return;
    }

    const nextInvaderId = scheduler.getNextDueInvader(now);
    if (!nextInvaderId) {
      return;
    }

    const target = this.gameState.getState().invaders.find((invader) => invader.id === nextInvaderId);
    if (!target) {
      scheduler.clearInvader(nextInvaderId);
      return;
    }

    const durationMs = this.promptSynth.playSequence({
      invaderId: target.id,
      notes: target.pattern,
      noteDurationMs: PROMPT_NOTE_DURATION_MS,
      gapMs: PROMPT_NOTE_GAP_MS,
      onNoteStart: (_note, _index, invaderId) => {
        this.playPitchPromptGlow(invaderId);
      },
      onSequenceComplete: () => {
        scheduler.clearActivePrompt();
        this.syncMicrophoneSuppressionFromScheduler();
      },
    });
    this.setMicrophoneSuppression(true);
    scheduler.markPromptStarted(target.id, now, durationMs);
  }

  private setMicrophoneSuppression(suppressed: boolean): void {
    if (this.microphoneSuppressed === suppressed) {
      return;
    }

    this.microphoneSuppressed = suppressed;
    gameBridge.publishMicrophoneSuppression({ suppressed });
  }

  private syncMicrophoneSuppressionFromScheduler(): void {
    if (this.arenaConfig.mode !== 'pitch') {
      this.setMicrophoneSuppression(false);
      return;
    }

    const active = this.promptScheduler?.isPromptActive(this.time.now) ?? false;
    this.setMicrophoneSuppression(active);
  }

  private playPitchPromptGlow(invaderId: string): void {
    const view = this.invaderViews.get(invaderId);
    if (!view) {
      return;
    }

    const promptRing = this.add.circle(0, 0, INVADER_HALO_RADIUS + 8, PITCH_GLOW_COLOR, 0.32);
    promptRing.setBlendMode(Phaser.BlendModes.ADD);
    view.container.addAt(promptRing, 0);
    view.shell.setStrokeStyle(3, PITCH_GLOW_COLOR, 1);

    this.tweens.add({
      targets: promptRing,
      alpha: 0,
      scaleX: 1.16,
      scaleY: 1.16,
      duration: PITCH_GLOW_DURATION_MS,
      ease: 'Cubic.Out',
      onComplete: () => {
        promptRing.destroy();
        view.shell.setStrokeStyle(2, 0x22d3ee, 0.9);
      },
    });
  }
}
