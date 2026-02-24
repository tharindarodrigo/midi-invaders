import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: posthogMock,
}));

const setDoNotTrack = (value: string | undefined): void => {
  Object.defineProperty(window.navigator, 'doNotTrack', {
    configurable: true,
    value,
  });
};

describe('analytics service', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    setDoNotTrack(undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setDoNotTrack(undefined);
  });

  it('does not capture when init is skipped or disabled by environment', async () => {
    const analytics = await import('@/services/analytics');
    analytics.trackAnalyticsEvent('midi_connect_attempted', {});
    expect(posthogMock.capture).not.toHaveBeenCalled();

    analytics.initAnalytics({
      apiKey: 'phc_test',
      apiHost: 'https://us.i.posthog.com',
      isProduction: false,
    });

    analytics.trackAnalyticsEvent('midi_connect_attempted', {});
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });

  it('initializes posthog once with expected options', async () => {
    const analytics = await import('@/services/analytics');
    analytics.initAnalytics({
      apiKey: 'phc_test',
      apiHost: 'https://us.i.posthog.com',
      isProduction: true,
    });
    analytics.initAnalytics({
      apiKey: 'phc_other',
      apiHost: 'https://us.i.posthog.com',
      isProduction: true,
    });

    expect(posthogMock.init).toHaveBeenCalledTimes(1);
    expect(posthogMock.init).toHaveBeenCalledWith('phc_test', {
      api_host: 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
    });
    expect(posthogMock.capture).toHaveBeenCalledWith(
      'app_loaded',
      expect.objectContaining({ path: '/', is_dnt: false }),
    );
  });

  it('disables analytics by default when do-not-track is enabled', async () => {
    setDoNotTrack('1');
    const analytics = await import('@/services/analytics');
    analytics.initAnalytics({
      apiKey: 'phc_test',
      apiHost: 'https://us.i.posthog.com',
      isProduction: true,
    });

    expect(analytics.isAnalyticsEnabled()).toBe(false);
    expect(posthogMock.opt_out_capturing).toHaveBeenCalled();
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });

  it('uses explicit stored preference over do-not-track defaults', async () => {
    const preferences = await import('@/services/analyticsPreferences');
    preferences.setStoredAnalyticsEnabled(true);
    setDoNotTrack('1');

    const analytics = await import('@/services/analytics');
    analytics.initAnalytics({
      apiKey: 'phc_test',
      apiHost: 'https://us.i.posthog.com',
      isProduction: true,
    });

    expect(analytics.isAnalyticsEnabled()).toBe(true);
    expect(posthogMock.opt_in_capturing).toHaveBeenCalled();
    expect(posthogMock.capture).toHaveBeenCalledWith(
      'app_loaded',
      expect.objectContaining({ is_dnt: true }),
    );
  });

  it('toggles opt-in and opt-out capture state', async () => {
    const analytics = await import('@/services/analytics');
    analytics.initAnalytics({
      apiKey: 'phc_test',
      apiHost: 'https://us.i.posthog.com',
      isProduction: true,
    });

    posthogMock.capture.mockClear();

    analytics.setAnalyticsEnabled(false);
    analytics.trackAnalyticsEvent('microphone_connect_attempted', {});
    expect(posthogMock.opt_out_capturing).toHaveBeenCalled();
    expect(posthogMock.capture).not.toHaveBeenCalled();

    analytics.setAnalyticsEnabled(true);
    analytics.trackAnalyticsEvent('microphone_connect_attempted', {});
    expect(posthogMock.opt_in_capturing).toHaveBeenCalled();
    expect(posthogMock.capture).toHaveBeenCalledWith('microphone_connect_attempted', {});
  });
});
