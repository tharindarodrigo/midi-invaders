const STORED_ANALYTICS_ENABLED_KEY = 'midi-invaders:analytics-enabled';

const canUseStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const getStoredAnalyticsEnabled = (): boolean | null => {
  if (!canUseStorage()) {
    return null;
  }

  const storedValue = window.localStorage.getItem(STORED_ANALYTICS_ENABLED_KEY);
  if (storedValue === 'true') {
    return true;
  }

  if (storedValue === 'false') {
    return false;
  }

  return null;
};

export const setStoredAnalyticsEnabled = (enabled: boolean): void => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORED_ANALYTICS_ENABLED_KEY, enabled ? 'true' : 'false');
};

const isDoNotTrackEnabled = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const doNotTrack = navigator.doNotTrack;
  return doNotTrack === '1' || doNotTrack === 'yes';
};

export const resolveInitialAnalyticsEnabled = (): boolean => {
  const storedPreference = getStoredAnalyticsEnabled();
  if (storedPreference !== null) {
    return storedPreference;
  }

  return !isDoNotTrackEnabled();
};
