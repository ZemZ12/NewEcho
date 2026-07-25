import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme-preference';

type ThemeContextValue = {
  preference: ThemePreference;
  colorScheme: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  colorScheme: 'light',
  setPreference: () => {},
});

// Wraps NativeWind's own color-scheme control (which drives every `dark:`
// class in the app) with a user-facing preference that persists across
// restarts. NativeWind's colorScheme state alone is in-memory only and
// resets to following the OS on every app launch.
export function AppThemeProvider({ children }: PropsWithChildren) {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
          setColorScheme(stored);
        }
      })
      .catch((err) => console.warn('Could not load theme preference:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    setColorScheme(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((err) => console.warn('Could not save theme preference:', err));
  }

  return (
    <ThemeContext.Provider value={{ preference, colorScheme: colorScheme ?? 'light', setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
