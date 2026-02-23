import { describe, expect, it } from 'vitest';
import { PromptScheduler } from '@/game/systems/promptScheduler';

describe('prompt scheduler', () => {
  it('cycles due prompts in round-robin order', () => {
    const scheduler = new PromptScheduler(2200);
    scheduler.syncInvaders(['a', 'b', 'c'], 0);

    const first = scheduler.getNextDueInvader(0);
    scheduler.markPromptStarted(first ?? '', 0, 350);

    const duringFirst = scheduler.getNextDueInvader(100);
    const second = scheduler.getNextDueInvader(400);
    scheduler.markPromptStarted(second ?? '', 400, 350);

    const third = scheduler.getNextDueInvader(800);

    expect(first).toBe('a');
    expect(duringFirst).toBeNull();
    expect(second).toBe('b');
    expect(third).toBe('c');
  });

  it('never returns a new due invader while one prompt is active', () => {
    const scheduler = new PromptScheduler(2200);
    scheduler.syncInvaders(['a', 'b'], 0);

    const first = scheduler.getNextDueInvader(0);
    scheduler.markPromptStarted(first ?? '', 0, 500);

    expect(scheduler.getNextDueInvader(100)).toBeNull();
    expect(scheduler.getNextDueInvader(400)).toBeNull();
    expect(scheduler.getNextDueInvader(501)).toBe('b');
  });

  it('shifts due times and active window when delayed', () => {
    const scheduler = new PromptScheduler(2200);
    scheduler.syncInvaders(['a'], 0);

    const first = scheduler.getNextDueInvader(0);
    scheduler.markPromptStarted(first ?? '', 0, 300);
    scheduler.delayAll(1000);

    expect(scheduler.isPromptActive(900)).toBe(true);
    expect(scheduler.isPromptActive(1300)).toBe(false);
    expect(scheduler.getNextDueInvader(2500)).toBeNull();
    expect(scheduler.getNextDueInvader(3200)).toBe('a');
  });
});

