import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ProfileProvider, useProfile } from '@/hooks/useProfile';
import { StreamChatProvider } from '@/hooks/useStreamChat';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, initializing } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  if (initializing || (user && profileLoading)) {
    return null;
  }

  const hasAccount = !!user && !!profile;

  return (
    <Stack>
      <Stack.Protected guard={hasAccount}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="new-group" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!user && !profile}>
        <Stack.Screen name="choose-username" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <ProfileProvider>
          <StreamChatProvider>
            <RootNavigator />
          </StreamChatProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
