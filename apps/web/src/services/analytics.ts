import posthog from 'posthog-js';
import {
  resolveInitialAnalyticsEnabled,
  setStoredAnalyticsEnabled,
} from '@/services/analyticsPreferences';
import type { AnalyticsEventName, AnalyticsEventProps } from '@/types/analytics';

interface InitAnalyticsOptions {
  apiKey?: string;
  apiHost?: string;
  isProduction: boolean;
}

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

let analyticsInitialized = false;
let captureEnabled = false;
let analyticsEnabled = resolveInitialAnalyticsEnabled();

const isDoNotTrackEnabled = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes';
};

const getAnalyticsContext = (): { timezone: string; locale: string } => {
  const timezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
    } catch {
      return 'unknown';
    }
  })();

  const locale = typeof navigator !== 'undefined' ? navigator.language || 'unknown' : 'unknown';
  return { timezone, locale };
};

export const initAnalytics = ({ apiKey, apiHost, isProduction }: InitAnalyticsOptions): void => {
  if (analyticsInitialized) {
    return;
  }

  analyticsInitialized = true;
  analyticsEnabled = resolveInitialAnalyticsEnabled();

  const trimmedApiKey = apiKey?.trim() ?? '';
  if (!isProduction || trimmedApiKey.length === 0) {
    captureEnabled = false;
    return;
  }

  posthog.init(trimmedApiKey, {
    api_host: apiHost?.trim() || DEFAULT_POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
  });
  captureEnabled = true;

  if (analyticsEnabled) {
    posthog.opt_in_capturing();
    trackAnalyticsEvent('app_loaded', {
      path: typeof window !== 'undefined' ? window.location.pathname : '/',
      is_dnt: isDoNotTrackEnabled(),
    });
    return;
  }

  posthog.opt_out_capturing();
};

export const trackAnalyticsEvent = <T extends AnalyticsEventName>(
  eventName: T,
  props: AnalyticsEventProps[T],
): void => {
  if (!captureEnabled || !analyticsEnabled) {
    return;
  }

  posthog.capture(eventName, { ...props, ...getAnalyticsContext() });
};

export const isAnalyticsEnabled = (): boolean => analyticsEnabled;

export const setAnalyticsEnabled = (enabled: boolean): void => {
  analyticsEnabled = enabled;
  setStoredAnalyticsEnabled(enabled);

  if (!captureEnabled) {
    return;
  }

  if (enabled) {
    posthog.opt_in_capturing();
    return;
  }

  posthog.opt_out_capturing();
};
