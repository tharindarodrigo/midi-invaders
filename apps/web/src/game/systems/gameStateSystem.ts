import type {
  ArenaConfig,
  ArenaState,
  ArenaStepResult,
  InvaderEntity,
  NoteProcessResult,
} from '@/types/gameplay';
import { createLaserShot } from '@/game/systems/combatSystem';
import { PitchMatcher } from '@/game/systems/pitchMatcher';
import {
  buildRadialInvader,
  computeMaxInvaders,
  computeSpawnIntervalMs,
  distanceToCore,
} from '@/game/systems/radialSpawner';
import { resolveNearestThreatTarget } from '@/game/systems/targetResolver';

const LIFE_UP_THRESHOLD = 1000;
const POWER_UP_DESTROY_COUNT = 5;

const createInitialState = (config: ArenaConfig): ArenaState => ({
  score: 0,
  lifeScore: 0,
  wave: 1,
  lives: config.startingLives,
  gameOver: false,
  hitsThisWave: 0,
  invaders: [],
  lasers: [],
});

export class GameStateSystem {
  private state: ArenaState;
  private nextSpawnAt = 0;
  private invaderSequence = 0;
  private laserSequence = 0;
  private readonly pitchMatcher: PitchMatcher;

  constructor(
    private readonly config: ArenaConfig,
    private readonly random: () => number = Math.random,
  ) {
    this.state = createInitialState(config);
    this.pitchMatcher = new PitchMatcher(config.sequenceWindowMs);
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

    if (seedInitialWave) {
      const initialInvaders = computeMaxInvaders(this.config, 1);
      for (let i = 0; i < initialInvaders; i += 1) {
        this.state.invaders.push(this.spawnOne(now));
      }
    }

    this.pitchMatcher.syncInvaders(this.state.invaders, now);
    this.nextSpawnAt = now + computeSpawnIntervalMs(this.config, this.state.wave);
  }

  getState(): ArenaState {
    return this.state;
  }

  processNote(note: number, now: number): NoteProcessResult {
    if (this.state.gameOver) {
      return this.createIgnoredResult();
    }

    if (this.config.mode === 'pitch') {
      return this.processPitchNote(note, now);
    }

    const resolution = resolveNearestThreatTarget({
      invaders: this.state.invaders,
      note,
      centerX: this.config.centerX,
      centerY: this.config.centerY,
    });

    if (!resolution.matched || !resolution.target) {
      return this.processMiss();
    }

    return this.processHit(resolution.target, now);
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
      return {
        kind: 'progress',
        target: resolution.target,
        laser: null,
        waveAdvanced: false,
        scoreDelta: 0,
        powerUp: {
          activated: false,
          destroyedInvaders: [],
        },
      };
    }

    return this.processHit(resolution.target, now);
  }

  private processMiss(): NoteProcessResult {
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
    const scoreDelta = this.config.basePoints;
    const extraLives = this.applyScoreDelta(scoreDelta);
    const destroyedByPowerUp = extraLives > 0 ? this.destroyNearestInvaders(POWER_UP_DESTROY_COUNT) : [];

    this.state.hitsThisWave += 1;
    let waveAdvanced = false;
    const hitsRequired = computeMaxInvaders(this.config, this.state.wave);
    if (this.state.hitsThisWave >= hitsRequired) {
      this.state.wave += 1;
      this.state.hitsThisWave = 0;
      waveAdvanced = true;
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
    const maxInvaders = computeMaxInvaders(this.config, this.state.wave);

    while (now >= this.nextSpawnAt && this.state.invaders.length < maxInvaders) {
      const invader = this.spawnOne(now);
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
    });
  }

  clearInvadersForTest(): void {
    this.state.invaders = [];
    this.pitchMatcher.resetAll([]);
  }

  private spawnOne(now: number): InvaderEntity {
    const pattern = this.generatePattern();
    const note = pattern[0];
    const invader = buildRadialInvader({
      config: this.config,
      id: `invader-${this.invaderSequence}`,
      note,
      wave: this.state.wave,
      now,
      random: this.random,
    });

    invader.pattern = pattern;
    this.invaderSequence += 1;
    return invader;
  }

  private generatePattern(): number[] {
    const notePool = this.config.notePool;
    const patternLength = Math.max(1, this.config.patternLength);
    const fallbackNote = notePool[0] ?? 60;
    if (notePool.length === 0) {
      return Array.from({ length: patternLength }, () => fallbackNote);
    }

    const pattern: number[] = [];
    for (let index = 0; index < patternLength; index += 1) {
      const note = notePool[Math.floor(this.random() * notePool.length)] ?? fallbackNote;
      pattern.push(note);
    }

    return pattern;
  }
}
