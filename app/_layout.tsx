import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import '../global.css';

import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useNotificationNavigation } from '@/hooks/useNotificationNavigation';
import { ProfileProvider, useProfile } from '@/hooks/useProfile';
import { StreamChatProvider } from '@/hooks/useStreamChat';
import { AppThemeProvider, useAppTheme } from '@/hooks/useTheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, initializing } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  useNotificationNavigation();

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
        <Stack.Screen name="communities/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="communities/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="new-channel" options={{ presentation: 'modal' }} />
        <Stack.Screen name="stock/[symbol]" options={{ presentation: 'modal' }} />
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

function ThemedApp() {
  const { colorScheme } = useAppTheme();

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

export default function RootLayout() {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <ThemedApp />
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
