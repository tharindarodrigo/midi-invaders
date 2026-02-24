import { afterEach, describe, expect, it } from 'vitest';
import {
  getStoredAnalyticsEnabled,
  resolveInitialAnalyticsEnabled,
  setStoredAnalyticsEnabled,
} from '@/services/analyticsPreferences';

const setDoNotTrack = (value: string | undefined): void => {
  Object.defineProperty(window.navigator, 'doNotTrack', {
    configurable: true,
    value,
  });
};

describe('analyticsPreferences', () => {
  afterEach(() => {
    window.localStorage.clear();
    setDoNotTrack(undefined);
  });

  it('returns null when no analytics preference is stored', () => {
    expect(getStoredAnalyticsEnabled()).toBeNull();
  });

  it('persists and reads analytics preference', () => {
    setStoredAnalyticsEnabled(true);
    expect(getStoredAnalyticsEnabled()).toBe(true);

    setStoredAnalyticsEnabled(false);
    expect(getStoredAnalyticsEnabled()).toBe(false);
  });

  it('defaults to disabled when do-not-track is enabled', () => {
    setDoNotTrack('1');
    expect(resolveInitialAnalyticsEnabled()).toBe(false);
  });

  it('defaults to enabled when do-not-track is not enabled', () => {
    setDoNotTrack(undefined);
    expect(resolveInitialAnalyticsEnabled()).toBe(true);
  });

  it('uses stored preference over do-not-track', () => {
    setDoNotTrack('1');
    setStoredAnalyticsEnabled(true);

    expect(resolveInitialAnalyticsEnabled()).toBe(true);
  });
});
