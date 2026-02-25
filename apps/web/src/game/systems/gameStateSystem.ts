import type {
  ArenaConfig,
  ArenaState,
  ArenaStepResult,
  InvaderEntity,
  NoteProcessResult,
} from '@/types/gameplay';
import type { InputSource } from '@/types/input';
import { getArcadeWaveRuleForWave } from '@/game/arenaConfig';
import { resolveInvaderClef } from '@/game/notationProfile';
import { createLaserShot } from '@/game/systems/combatSystem';
import { ChordMatcher } from '@/game/systems/chordMatcher';
import { PitchMatcher } from '@/game/systems/pitchMatcher';
import {
  buildRadialInvader,
  computeInvaderSpeed,
  computeMaxInvaders,
  computeSpawnIntervalMs,
  distanceToCore,
} from '@/game/systems/radialSpawner';
import { resolveNearestThreatTarget } from '@/game/systems/targetResolver';

const LIFE_UP_THRESHOLD = 1000;
const POWER_UP_DESTROY_COUNT = 5;
const SPAWN_SELECTION_ATTEMPTS = 12;
const WAVE_SCORE_THRESHOLD = 1000;
const MICROPHONE_NOTE_TOLERANCE = 1;
const MICROPHONE_CHORD_ARPEGGIO_WINDOW_MS = 1800;

const createInitialState = (config: ArenaConfig): ArenaState => ({
  score: 0,
  lifeScore: 0,
  wave: 1,
  lives: config.startingLives,
  gameOver: false,
  invaders: [],
  lasers: [],
});

export class GameStateSystem {
  private state: ArenaState;
  private nextSpawnAt = 0;
  private invaderSequence = 0;
  private laserSequence = 0;
  private readonly pitchMatcher: PitchMatcher;
  private readonly chordMatcher: ChordMatcher;

  constructor(
    private readonly config: ArenaConfig,
    private readonly random: () => number = Math.random,
  ) {
    this.state = createInitialState(config);
    this.pitchMatcher = new PitchMatcher(config.sequenceWindowMs);
    this.chordMatcher = new ChordMatcher(
      config.chordSimultaneousWindowMs,
      config.chordArpeggioWindowMs,
    );
  }

  reset(now: number): void {
    this.resetState(now, true);
  }

  resetForTests(now: number): void {
    this.resetState(now, false);
  }

  private resetState(now: number, seedInitialWave: boolean): void {
    this.state = createInitialState(this.config);
    this.invaderSequence = 0;
    this.laserSequence = 0;
    this.pitchMatcher.resetAll([]);
    this.chordMatcher.reset();

    if (seedInitialWave) {
      const initialInvaders = this.getHitsRequiredForWave(1);
      for (let i = 0; i < initialInvaders; i += 1) {
        const invader = this.spawnOne(now);
        if (invader) {
          this.state.invaders.push(invader);
        }
      }
    }

    this.pitchMatcher.syncInvaders(this.state.invaders, now);
    this.nextSpawnAt = now + computeSpawnIntervalMs(this.config, this.state.wave);
  }

  getState(): ArenaState {
    return this.state;
  }

  processNote(note: number, now: number, source: InputSource = 'keyboard'): NoteProcessResult {
    if (this.state.gameOver) {
      return this.createIgnoredResult();
    }

    if (this.config.mode === 'pitch') {
      return this.processPitchNote(note, now);
    }

    const isMicrophoneInput = source === 'microphone';
    const noteToleranceSemitones = isMicrophoneInput ? MICROPHONE_NOTE_TOLERANCE : 0;

    const chordResolution = this.chordMatcher.matchChord({
      invaders: this.state.invaders,
      note,
      now,
      centerX: this.config.centerX,
      centerY: this.config.centerY,
      noteToleranceSemitones,
      arpeggioWindowMs: isMicrophoneInput
        ? Math.max(this.config.chordArpeggioWindowMs, MICROPHONE_CHORD_ARPEGGIO_WINDOW_MS)
        : this.config.chordArpeggioWindowMs,
    });
    if (chordResolution.kind === 'hit' && chordResolution.target) {
      return this.processHit(chordResolution.target, now);
    }

    const singleResolution = resolveNearestThreatTarget({
      invaders: this.state.invaders,
      note,
      centerX: this.config.centerX,
      centerY: this.config.centerY,
      noteToleranceSemitones,
    });
    if (singleResolution.matched && singleResolution.target) {
      return this.processHit(singleResolution.target, now);
    }

    if (chordResolution.kind === 'progress' && chordResolution.target) {
      return this.createProgressResult(chordResolution.target);
    }

    return this.processMiss();
  }

  private processPitchNote(note: number, now: number): NoteProcessResult {
    this.pitchMatcher.syncInvaders(this.state.invaders, now);
    const resolution = this.pitchMatcher.matchNote({
      invaders: this.state.invaders,
      note,
      now,
      centerX: this.config.centerX,
      centerY: this.config.centerY,
    });

    if (resolution.kind === 'miss' || !resolution.target) {
      return this.processMiss();
    }

    if (resolution.kind === 'progress') {
      return this.createProgressResult(resolution.target);
    }

    return this.processHit(resolution.target, now);
  }

  private createProgressResult(target: InvaderEntity): NoteProcessResult {
    return {
      kind: 'progress',
      target,
      laser: null,
      waveAdvanced: false,
      scoreDelta: 0,
      powerUp: {
        activated: false,
        destroyedInvaders: [],
      },
    };
  }

  private processMiss(): NoteProcessResult {
    this.chordMatcher.reset();
    this.applyScoreDelta(-this.config.missPenaltyPoints);
    return {
      kind: 'miss',
      target: null,
      laser: null,
      waveAdvanced: false,
      scoreDelta: -this.config.missPenaltyPoints,
      powerUp: {
        activated: false,
        destroyedInvaders: [],
      },
    };
  }

  private processHit(target: InvaderEntity, now: number): NoteProcessResult {
    this.pitchMatcher.removeInvader(target.id);
    this.state.invaders = this.state.invaders.filter((invader) => invader.id !== target.id);
    const scoreDelta = target.points;
    const extraLives = this.applyScoreDelta(scoreDelta);
    const destroyedByPowerUp = extraLives > 0 ? this.destroyNearestInvaders(POWER_UP_DESTROY_COUNT) : [];

    let waveAdvanced = false;
    const nextWave = this.resolveWaveFromScore(this.state.score);
    if (nextWave > this.state.wave) {
      this.state.wave = nextWave;
      this.nextSpawnAt = Math.max(this.nextSpawnAt, now + computeSpawnIntervalMs(this.config, this.state.wave));
      waveAdvanced = true;
    }

    if (this.config.mode === 'arcade') {
      this.syncArcadeInvaderSpeeds();
    }

    const laser = createLaserShot({
      id: `laser-${this.laserSequence}`,
      config: this.config,
      toX: target.x,
      toY: target.y,
      now,
    });
    this.laserSequence += 1;
    this.state.lasers = [...this.state.lasers, laser];

    return {
      kind: 'hit',
      target,
      laser,
      waveAdvanced,
      scoreDelta,
      powerUp: {
        activated: extraLives > 0,
        destroyedInvaders: destroyedByPowerUp,
      },
    };
  }

  private syncArcadeInvaderSpeeds(): void {
    if (this.config.mode !== 'arcade') {
      return;
    }

    const scoreProgressInWave = this.getScoreProgressInCurrentWave();
    const speed = computeInvaderSpeed(this.config, this.state.wave, {
      hitsThisWave: scoreProgressInWave,
      hitsRequired: WAVE_SCORE_THRESHOLD,
    });

    for (const invader of this.state.invaders) {
      const directionLength = Math.hypot(invader.vx, invader.vy) || 1;
      invader.vx = (invader.vx / directionLength) * speed;
      invader.vy = (invader.vy / directionLength) * speed;
      invader.speed = speed;
    }
  }

  private createIgnoredResult(): NoteProcessResult {
    return {
      kind: 'ignored',
      target: null,
      laser: null,
      waveAdvanced: false,
      scoreDelta: 0,
      powerUp: {
        activated: false,
        destroyedInvaders: [],
      },
    };
  }

  private applyScoreDelta(scoreDelta: number): number {
    this.state.score += scoreDelta;

    if (!this.config.lifeUpsEnabled) {
      this.state.lifeScore = 0;
      return 0;
    }

    const nextLifeScore = this.state.lifeScore + scoreDelta;
    if (nextLifeScore <= 0) {
      this.state.lifeScore = 0;
      return 0;
    }

    const extraLives = Math.floor(nextLifeScore / LIFE_UP_THRESHOLD);
    this.state.lifeScore = nextLifeScore % LIFE_UP_THRESHOLD;

    if (extraLives > 0) {
      this.state.lives += extraLives;
    }

    return extraLives;
  }

  private destroyNearestInvaders(count: number): InvaderEntity[] {
    if (count <= 0 || this.state.invaders.length === 0) {
      return [];
    }

    const centerX = this.config.centerX;
    const centerY = this.config.centerY;
    const sortedByDistance = [...this.state.invaders].sort((left, right) => {
      const leftDistanceSq = (left.x - centerX) ** 2 + (left.y - centerY) ** 2;
      const rightDistanceSq = (right.x - centerX) ** 2 + (right.y - centerY) ** 2;
      return leftDistanceSq - rightDistanceSq;
    });
    const destroyedInvaders = sortedByDistance.slice(0, count);
    const destroyedIds = new Set(destroyedInvaders.map((invader) => invader.id));
    this.state.invaders = this.state.invaders.filter((invader) => !destroyedIds.has(invader.id));
    this.pitchMatcher.removeInvaders(destroyedInvaders.map((invader) => invader.id));

    return destroyedInvaders;
  }

  delayTimersForFreeze(durationMs: number): void {
    if (durationMs <= 0) {
      return;
    }

    this.nextSpawnAt += durationMs;
    for (const laser of this.state.lasers) {
      laser.expiresAt += durationMs;
    }
  }

  step(now: number, deltaMs: number): ArenaStepResult {
    if (this.state.gameOver) {
      return {
        spawned: [],
        reachedCore: [],
        expiredLaserIds: [],
        gameOver: true,
      };
    }

    const seconds = deltaMs / 1000;
    for (const invader of this.state.invaders) {
      invader.x += invader.vx * seconds;
      invader.y += invader.vy * seconds;
    }

    const reachedCore: InvaderEntity[] = [];
    const survivingInvaders: InvaderEntity[] = [];

    for (const invader of this.state.invaders) {
      if (distanceToCore(invader, this.config) <= this.config.coreRadius) {
        reachedCore.push(invader);
      } else {
        survivingInvaders.push(invader);
      }
    }

    if (!this.config.infiniteLives && reachedCore.length > 0) {
      this.state.lives = Math.max(0, this.state.lives - reachedCore.length);
    }

    this.state.invaders = survivingInvaders;
    this.pitchMatcher.removeInvaders(reachedCore.map((invader) => invader.id));
    this.pitchMatcher.syncInvaders(this.state.invaders, now);

    if (this.state.lives <= 0) {
      this.state.gameOver = true;
      return {
        spawned: [],
        reachedCore,
        expiredLaserIds: [],
        gameOver: true,
      };
    }

    const previousLaserIds = new Set(this.state.lasers.map((laser) => laser.id));
    this.state.lasers = this.state.lasers.filter((laser) => laser.expiresAt > now);
    const expiredLaserIds = [...previousLaserIds].filter(
      (laserId) => !this.state.lasers.some((laser) => laser.id === laserId),
    );

    const spawned: InvaderEntity[] = [];
    const maxInvaders = this.getHitsRequiredForWave(this.state.wave);

    while (
      now >= this.nextSpawnAt
      && this.state.invaders.length < maxInvaders
    ) {
      const invader = this.spawnOne(now);
      if (!invader) {
        break;
      }

      this.state.invaders.push(invader);
      spawned.push(invader);
      this.nextSpawnAt += computeSpawnIntervalMs(this.config, this.state.wave);
    }

    this.pitchMatcher.syncInvaders(this.state.invaders, now);

    if (this.state.lives <= 0) {
      this.state.gameOver = true;
    }

    return {
      spawned,
      reachedCore,
      expiredLaserIds,
      gameOver: this.state.gameOver,
    };
  }

  addInvaderForTest(invader: InvaderEntity): void {
    this.state.invaders.push({
      ...invader,
      pattern: invader.pattern.length > 0 ? [...invader.pattern] : [invader.note],
      requiredNotes:
        invader.requiredNotes.length > 0 ? [...invader.requiredNotes] : [invader.note],
      points: invader.points || this.config.basePoints,
      targetType: invader.targetType ?? 'single',
    });
  }

  clearInvadersForTest(): void {
    this.state.invaders = [];
    this.pitchMatcher.resetAll([]);
    this.chordMatcher.reset();
  }

  private getHitsRequiredForWave(wave: number): number {
    return Math.max(1, computeMaxInvaders(this.config, wave));
  }

  private spawnOne(now: number): InvaderEntity | null {
    if (this.config.mode === 'pitch') {
      return this.spawnPitchInvader(now);
    }

    if (this.config.mode === 'arcade') {
      return this.spawnArcadeInvader(now);
    }

    return this.spawnSingleInvader(now, this.config.notePool, this.config.clefMode);
  }

  private spawnPitchInvader(now: number): InvaderEntity | null {
    const pattern = this.generatePattern(this.config.notePool, this.config.patternLength);
    const note = pattern[0];
    const invader = this.buildInvader(now, note);
    invader.pattern = pattern;
    invader.requiredNotes = [note];
    invader.targetType = 'pattern';
    invader.points = this.config.basePoints;
    invader.clef = resolveInvaderClef(this.config.clefMode, note, invader.id);
    this.invaderSequence += 1;
    return invader;
  }

  private spawnSingleInvader(now: number, notePool: number[], clefMode: ArenaConfig['clefMode']): InvaderEntity | null {
    const activeSingleNotes = new Set(
      this.state.invaders
        .filter((invader) => invader.targetType === 'single')
        .map((invader) => invader.note),
    );
    const uniqueCandidates = notePool.filter((candidate) => !activeSingleNotes.has(candidate));
    const note = this.pickRandom(uniqueCandidates.length > 0 ? uniqueCandidates : notePool);
    if (note === null) {
      return null;
    }

    const invader = this.buildInvader(now, note);
    invader.pattern = [note];
    invader.requiredNotes = [note];
    invader.targetType = 'single';
    invader.points = this.config.basePoints;
    invader.clef = resolveInvaderClef(clefMode, note, invader.id);
    this.invaderSequence += 1;
    return invader;
  }

  private spawnArcadeInvader(now: number): InvaderEntity | null {
    const waveRule = getArcadeWaveRuleForWave(this.config, this.state.wave);
    if (!waveRule) {
      return this.spawnSingleInvader(now, this.config.notePool, this.config.clefMode);
    }

    const activeSingleNotes = new Set(
      this.state.invaders
        .filter((invader) => invader.targetType === 'single')
        .map((invader) => invader.note),
    );
    const canUseChord = waveRule.allowedTargets.includes('chord') && waveRule.chordRootPool.length > 0;
    const canUseSingle = waveRule.allowedTargets.includes('single') && waveRule.singleNotePool.length > 0;

    for (let attempt = 0; attempt < SPAWN_SELECTION_ATTEMPTS; attempt += 1) {
      const preferChord = canUseChord && (!canUseSingle || this.random() < waveRule.chordChance);
      if (preferChord) {
        const chord = this.tryBuildArcadeChordInvader(now, waveRule.chordRootPool, waveRule.clefMode, activeSingleNotes);
        if (chord) {
          return chord;
        }
      }

      if (canUseSingle) {
        const single = this.tryBuildArcadeSingleInvader(now, waveRule.singleNotePool, waveRule.clefMode, activeSingleNotes);
        if (single) {
          return single;
        }
      }

      if (!preferChord && canUseChord) {
        const chordFallback = this.tryBuildArcadeChordInvader(now, waveRule.chordRootPool, waveRule.clefMode, activeSingleNotes);
        if (chordFallback) {
          return chordFallback;
        }
      }
    }

    if (waveRule.allowedTargets.includes('single')) {
      return this.spawnSingleInvader(now, waveRule.singleNotePool, waveRule.clefMode);
    }

    if (waveRule.allowedTargets.includes('chord')) {
      return this.tryBuildArcadeChordInvader(now, waveRule.chordRootPool, waveRule.clefMode, activeSingleNotes);
    }

    return null;
  }

  private tryBuildArcadeSingleInvader(
    now: number,
    notePool: number[],
    clefMode: ArenaConfig['clefMode'],
    activeSingleNotes: Set<number>,
  ): InvaderEntity | null {
    const candidates = notePool.filter((note) => !activeSingleNotes.has(note));
    const note = this.pickRandom(candidates);
    if (note === null) {
      return null;
    }

    const invader = this.buildInvader(now, note);
    invader.pattern = [note];
    invader.requiredNotes = [note];
    invader.targetType = 'single';
    invader.points = this.config.basePoints;
    invader.clef = resolveInvaderClef(clefMode, note, invader.id);
    this.invaderSequence += 1;
    return invader;
  }

  private tryBuildArcadeChordInvader(
    now: number,
    rootPool: number[],
    clefMode: ArenaConfig['clefMode'],
    activeSingleNotes: Set<number>,
  ): InvaderEntity | null {
    const candidateRoots = rootPool.filter((root) => !activeSingleNotes.has(root));
    const root = this.pickRandom(candidateRoots);
    if (root === null) {
      return null;
    }

    const requiredNotes = [root, root + 4, root + 7];
    const invader = this.buildInvader(now, root);
    invader.pattern = [root];
    invader.requiredNotes = requiredNotes;
    invader.targetType = 'chord';
    invader.points = this.config.chordPoints;
    invader.clef = resolveInvaderClef(clefMode, root, invader.id);
    this.invaderSequence += 1;
    return invader;
  }

  private buildInvader(now: number, note: number): InvaderEntity {
    const invader = buildRadialInvader({
      config: this.config,
      id: `invader-${this.invaderSequence}`,
      note,
      wave: this.state.wave,
      now,
      hitsThisWave: this.getScoreProgressInCurrentWave(),
      hitsRequired: WAVE_SCORE_THRESHOLD,
      random: this.random,
    });

    return invader;
  }

  private generatePattern(notePool: number[], patternLength: number): number[] {
    const safePatternLength = Math.max(1, patternLength);
    const fallbackNote = notePool[0] ?? 60;
    if (notePool.length === 0) {
      return Array.from({ length: safePatternLength }, () => fallbackNote);
    }

    const pattern: number[] = [];
    for (let index = 0; index < safePatternLength; index += 1) {
      const note = notePool[Math.floor(this.random() * notePool.length)] ?? fallbackNote;
      pattern.push(note);
    }

    return pattern;
  }

  private pickRandom(pool: number[]): number | null {
    if (pool.length === 0) {
      return null;
    }

    return pool[Math.floor(this.random() * pool.length)] ?? null;
  }

  private resolveWaveFromScore(score: number): number {
    const safeScore = Math.max(0, score);
    return Math.floor(safeScore / WAVE_SCORE_THRESHOLD) + 1;
  }

  private getScoreProgressInCurrentWave(): number {
    const currentWaveStartScore = (this.state.wave - 1) * WAVE_SCORE_THRESHOLD;
    return Math.max(0, Math.min(WAVE_SCORE_THRESHOLD, this.state.score - currentWaveStartScore));
  }
}
