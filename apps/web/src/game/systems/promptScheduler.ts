interface PromptScheduleState {
  nextPromptAt: number;
}

export class PromptScheduler {
  private readonly scheduleByInvaderId = new Map<string, PromptScheduleState>();
  private readonly turnOrder: string[] = [];
  private cursorIndex = 0;
  private activeInvaderId: string | null = null;
  private activeUntil = 0;

  constructor(private readonly repeatMs: number) {}

  syncInvaders(invaderIds: string[], now: number): void {
    const aliveIds = new Set(invaderIds);

    for (const existingInvaderId of [...this.scheduleByInvaderId.keys()]) {
      if (aliveIds.has(existingInvaderId)) {
        continue;
      }

      this.clearInvader(existingInvaderId);
    }

    for (const invaderId of invaderIds) {
      if (this.scheduleByInvaderId.has(invaderId)) {
        continue;
      }

      this.scheduleByInvaderId.set(invaderId, {
        nextPromptAt: now,
      });
      this.turnOrder.push(invaderId);
    }

    this.normalizeCursor();
  }

  clearInvader(invaderId: string): void {
    this.scheduleByInvaderId.delete(invaderId);
    const orderIndex = this.turnOrder.indexOf(invaderId);
    if (orderIndex !== -1) {
      this.turnOrder.splice(orderIndex, 1);
      if (orderIndex < this.cursorIndex) {
        this.cursorIndex -= 1;
      }
    }

    if (this.activeInvaderId === invaderId) {
      this.activeInvaderId = null;
      this.activeUntil = 0;
    }

    this.normalizeCursor();
  }

  clearInvaders(invaderIds: string[]): void {
    for (const invaderId of invaderIds) {
      this.clearInvader(invaderId);
    }
  }

  clearActivePrompt(): void {
    this.activeInvaderId = null;
    this.activeUntil = 0;
  }

  isPromptActive(now: number): boolean {
    return this.resolveActive(now) !== null;
  }

  getNextDueInvader(now: number): string | null {
    if (this.resolveActive(now)) {
      return null;
    }

    if (this.turnOrder.length === 0) {
      return null;
    }

    const dueInvader = this.findDueFromCursor(now);
    return dueInvader;
  }

  markPromptStarted(invaderId: string, now: number, promptDurationMs: number): void {
    const schedule = this.scheduleByInvaderId.get(invaderId);
    if (!schedule) {
      return;
    }

    schedule.nextPromptAt = now + this.repeatMs;
    this.activeInvaderId = invaderId;
    this.activeUntil = now + Math.max(0, promptDurationMs);

    const orderIndex = this.turnOrder.indexOf(invaderId);
    if (orderIndex !== -1) {
      this.cursorIndex = (orderIndex + 1) % Math.max(1, this.turnOrder.length);
    }
  }

  delayAll(ms: number): void {
    if (ms <= 0) {
      return;
    }

    for (const schedule of this.scheduleByInvaderId.values()) {
      schedule.nextPromptAt += ms;
    }

    if (this.activeInvaderId !== null) {
      this.activeUntil += ms;
    }
  }

  private findDueFromCursor(now: number): string | null {
    const count = this.turnOrder.length;
    if (count === 0) {
      return null;
    }

    for (let offset = 0; offset < count; offset += 1) {
      const index = (this.cursorIndex + offset) % count;
      const invaderId = this.turnOrder[index];
      const schedule = this.scheduleByInvaderId.get(invaderId);
      if (!schedule) {
        continue;
      }

      if (schedule.nextPromptAt <= now) {
        return invaderId;
      }
    }

    return null;
  }

  private resolveActive(now: number): string | null {
    if (!this.activeInvaderId) {
      return null;
    }

    if (now < this.activeUntil) {
      return this.activeInvaderId;
    }

    this.activeInvaderId = null;
    this.activeUntil = 0;
    return null;
  }

  private normalizeCursor(): void {
    if (this.turnOrder.length === 0) {
      this.cursorIndex = 0;
      return;
    }

    this.cursorIndex %= this.turnOrder.length;
    if (this.cursorIndex < 0) {
      this.cursorIndex = 0;
    }
  }
}

