import type {
  ArenaConfig,
  ArenaState,
  ArenaStepResult,
  InvaderEntity,
  NoteProcessResult,
} from '@/types/gameplay';
import { applyMissCooldown, createLaserShot, isWeaponCoolingDown } from '@/game/systems/combatSystem';
import {
  buildRadialInvader,
  computeMaxInvaders,
  computeSpawnIntervalMs,
  distanceToCore,
} from '@/game/systems/radialSpawner';
import { resolveNearestThreatTarget } from '@/game/systems/targetResolver';

const createInitialState = (config: ArenaConfig): ArenaState => ({
  score: 0,
  wave: 1,
  lives: config.startingLives,
  gameOver: false,
  hitsThisWave: 0,
  weaponCooldownUntil: 0,
  invaders: [],
  lasers: [],
});

export class GameStateSystem {
  private state: ArenaState;
  private nextSpawnAt = 0;
  private invaderSequence = 0;
  private laserSequence = 0;

  constructor(
    private readonly config: ArenaConfig,
    private readonly random: () => number = Math.random,
  ) {
    this.state = createInitialState(config);
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

    if (seedInitialWave) {
      const initialInvaders = computeMaxInvaders(this.config, 1);
      for (let i = 0; i < initialInvaders; i += 1) {
        this.state.invaders.push(this.spawnOne(now));
      }
    }

    this.nextSpawnAt = now + computeSpawnIntervalMs(this.config, this.state.wave);
  }

  getState(): ArenaState {
    return this.state;
  }

  processNote(note: number, now: number): NoteProcessResult {
    if (this.state.gameOver) {
      return {
        kind: 'cooldown',
        target: null,
        laser: null,
        waveAdvanced: false,
      };
    }

    if (isWeaponCoolingDown(this.state, now)) {
      return {
        kind: 'cooldown',
        target: null,
        laser: null,
        waveAdvanced: false,
      };
    }

    const resolution = resolveNearestThreatTarget({
      invaders: this.state.invaders,
      note,
      centerX: this.config.centerX,
      centerY: this.config.centerY,
    });

    if (!resolution.matched || !resolution.target) {
      applyMissCooldown(this.state, this.config, now);
      return {
        kind: 'miss',
        target: null,
        laser: null,
        waveAdvanced: false,
      };
    }

    const target = resolution.target;
    this.state.invaders = this.state.invaders.filter((invader) => invader.id !== target.id);
    this.state.score += this.config.basePoints;

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
    };
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

    if (reachedCore.length > 0) {
      this.state.lives = Math.max(0, this.state.lives - reachedCore.length);
    }

    this.state.invaders = survivingInvaders;

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
    this.state.invaders.push(invader);
  }

  clearInvadersForTest(): void {
    this.state.invaders = [];
  }

  private spawnOne(now: number): InvaderEntity {
    const note = this.config.notePool[Math.floor(this.random() * this.config.notePool.length)];
    const invader = buildRadialInvader({
      config: this.config,
      id: `invader-${this.invaderSequence}`,
      note,
      wave: this.state.wave,
      now,
      random: this.random,
    });

    this.invaderSequence += 1;
    return invader;
  }
}
