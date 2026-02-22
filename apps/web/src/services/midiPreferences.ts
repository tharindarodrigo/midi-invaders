const STORED_INPUT_ID_KEY = 'midi-invaders:selected-input-id';

const canUseStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const getStoredMidiInputId = (): string | null => {
  if (!canUseStorage()) {
    return null;
  }

  const storedValue = window.localStorage.getItem(STORED_INPUT_ID_KEY);
  return storedValue && storedValue.trim().length > 0 ? storedValue : null;
};

export const setStoredMidiInputId = (inputId: string | null): void => {
  if (!canUseStorage()) {
    return;
  }

  if (!inputId) {
    window.localStorage.removeItem(STORED_INPUT_ID_KEY);
    return;
  }

  window.localStorage.setItem(STORED_INPUT_ID_KEY, inputId);
};
