import type { ArenaConfig, InvaderEntity } from '@/types/gameplay';
import {
  getArcadeWaveLoop,
  getArcadeWaveRuleForWave,
} from '@/game/arenaConfig';

interface WaveProgressArgs {
  hitsThisWave?: number;
  hitsRequired?: number;
}

const resolveWaveProgress = ({ hitsThisWave = 0, hitsRequired = 0 }: WaveProgressArgs): number => {
  if (hitsRequired <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, hitsThisWave / hitsRequired));
};

export const computeInvaderSpeed = (
  config: ArenaConfig,
  wave: number,
  progress: WaveProgressArgs = {},
): number => {
  if (config.mode === 'arcade') {
    const waveRule = getArcadeWaveRuleForWave(config, wave);
    if (waveRule) {
      const waveProgress = resolveWaveProgress(progress);
      return waveRule.baseInvaderSpeed * (1 + waveRule.speedRampWithinWave * waveProgress);
    }
  }

  return config.baseInvaderSpeed * config.invaderSpeedGrowth ** (wave - 1);
};

export const computeSpawnIntervalMs = (config: ArenaConfig, wave: number): number => {
  if (config.mode === 'arcade') {
    const waveRule = getArcadeWaveRuleForWave(config, wave);
    if (waveRule) {
      const loop = getArcadeWaveLoop(wave, config.arcadeWaveRules.length);
      const interval = waveRule.baseSpawnIntervalMs * config.arcadeLoopSpawnIntervalScale ** loop;
      return Math.max(waveRule.minSpawnIntervalMs, Math.round(interval));
    }
  }

  const interval = config.baseSpawnIntervalMs * config.spawnIntervalDecay ** (wave - 1);
  return Math.max(config.minSpawnIntervalMs, Math.round(interval));
};

export const computeMaxInvaders = (config: ArenaConfig, wave: number): number => {
  if (config.mode === 'pitch') {
    return config.maxConcurrentInvaders;
  }

  if (config.mode === 'arcade') {
    const waveRule = getArcadeWaveRuleForWave(config, wave);
    if (waveRule) {
      const loop = getArcadeWaveLoop(wave, config.arcadeWaveRules.length);
      return waveRule.baseMaxInvaders + loop * config.arcadeLoopMaxInvaderIncrease;
    }
  }

  return config.baseMaxInvaders + (wave - 1);
};

const pickBorderSpawnPoint = (
  width: number,
  height: number,
  random: () => number,
): { x: number; y: number } => {
  const perimeter = 2 * (width + height);
  let offset = random() * perimeter;

  if (offset < width) {
    return { x: offset, y: 0 };
  }
  offset -= width;

  if (offset < height) {
    return { x: width, y: offset };
  }
  offset -= height;

  if (offset < width) {
    return { x: width - offset, y: height };
  }

  return { x: 0, y: height - (offset - width) };
};

interface BuildInvaderArgs {
  config: ArenaConfig;
  id: string;
  note: number;
  wave: number;
  now: number;
  hitsThisWave?: number;
  hitsRequired?: number;
  random: () => number;
}

export const buildRadialInvader = ({
  config,
  id,
  note,
  wave,
  now,
  hitsThisWave = 0,
  hitsRequired = 0,
  random,
}: BuildInvaderArgs): InvaderEntity => {
  const { x, y } = pickBorderSpawnPoint(config.width, config.height, random);
  const speed = computeInvaderSpeed(config, wave, {
    hitsThisWave,
    hitsRequired,
  });

  const dx = config.centerX - x;
  const dy = config.centerY - y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    id,
    note,
    pattern: [note],
    requiredNotes: [note],
    targetType: 'single',
    points: config.basePoints,
    clef: 'treble',
    x,
    y,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    speed,
    spawnedAt: now,
  };
};

export const distanceToCore = (invader: Pick<InvaderEntity, 'x' | 'y'>, config: Pick<ArenaConfig, 'centerX' | 'centerY'>): number => {
  return Math.hypot(invader.x - config.centerX, invader.y - config.centerY);
};
