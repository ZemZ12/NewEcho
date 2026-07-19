import { Ionicons } from '@expo/vector-icons';
import { getApp } from '@react-native-firebase/app';
import { getAuth, signInWithPhoneNumber, type ConfirmationResult } from '@react-native-firebase/auth';
import { Image } from 'expo-image';
import { AnimatePresence, MotiText, MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const ICON_SIZE = 104;
// Rotation normally pivots around a view's center (50%); shifting the pivot
// down to ~73% (matching the reference design's transform-origin) and back
// via translateY before/after the rotate gives the icon a pendulum-swing
// feel instead of spinning around its middle.
const PIVOT_OFFSET = ICON_SIZE * 0.23;

// Phone OTP entry, wired to Firebase Auth. Signing in updates the auth state
// listened to by the root layout, which then redirects out of this screen.
export default function OnboardingScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const swing = useSharedValue(-14);

  useEffect(() => {
    swing.value = withRepeat(withTiming(14, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [swing]);

  const swingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: PIVOT_OFFSET }, { rotate: `${swing.value}deg` }, { translateY: -PIVOT_OFFSET }],
  }));

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  async function handleSendCode() {
    const trimmed = phone.trim();
    if (!trimmed.startsWith('+')) {
      setError('Include your country code, e.g. +1 555 123 4567.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const auth = getAuth(getApp());
      const result = await signInWithPhoneNumber(auth, trimmed);
      setConfirmation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmCode() {
    if (!confirmation) return;
    setError(null);
    setLoading(true);
    try {
      await confirmation.confirm(code.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const primaryLabel = confirmation ? 'Verify' : 'Send code';
  const primaryDisabled = confirmation ? loading || code.length < 6 : loading || !phone;
  const primaryAction = confirmation ? handleConfirmCode : handleSendCode;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      {/* Soft floating accent blobs — a cheap, dependency-free stand-in for a
          blurred gradient background, since expo-linear-gradient/blur aren't
          installed (would mean another native rebuild for pure decoration). */}
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <MotiView
          from={{ translateY: -40, scale: 0.9 }}
          animate={{ translateY: 20, scale: 1.05 }}
          transition={{ type: 'timing', duration: 6000, loop: true, repeatReverse: true }}
          className="absolute -left-24 -top-16 h-72 w-72 rounded-full bg-accent/20"
        />
        <MotiView
          from={{ translateY: 30, scale: 1 }}
          animate={{ translateY: -20, scale: 1.1 }}
          transition={{ type: 'timing', duration: 7000, loop: true, repeatReverse: true }}
          className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-accent/10"
        />
      </View>

      <View className="flex-1 justify-center gap-8 px-8" style={{ paddingBottom: keyboardHeight }}>
        <View className="items-center gap-4">
          <MotiView
            from={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 12, mass: 0.8 }}>
            <Animated.View style={swingStyle}>
              <Image
                source={require('@/assets/images/echo-icon.svg')}
                style={{ width: ICON_SIZE, height: ICON_SIZE }}
                contentFit="contain"
              />
            </Animated.View>
          </MotiView>

          <MotiText
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 150 }}
            className="text-3xl font-bold text-zinc-900 dark:text-white">
            Welcome to Echo
          </MotiText>

          <MotiText
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 250 }}
            className="text-center text-base text-zinc-400 dark:text-zinc-500">
            {confirmation ? `Enter the code we sent to ${phone.trim()}.` : 'Sign in with your phone number to get started.'}
          </MotiText>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 350 }}
          className="gap-4 rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <AnimatePresence exitBeforeEnter>
            {!confirmation ? (
              <MotiView
                key="phone"
                from={{ opacity: 0, translateX: 16 }}
                animate={{ opacity: 1, translateX: 0 }}
                exit={{ opacity: 0, translateX: -16 }}
                transition={{ type: 'timing', duration: 220 }}
                className="gap-3">
                <View className="flex-row items-center rounded-2xl border border-zinc-200 px-4 dark:border-zinc-700">
                  <Ionicons name="call-outline" size={18} color="#a1a1aa" />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+1 555 123 4567"
                    placeholderTextColor="#a1a1aa"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    className="flex-1 py-3 pl-3 text-base text-zinc-900 dark:text-white"
                  />
                </View>
              </MotiView>
            ) : (
              <MotiView
                key="code"
                from={{ opacity: 0, translateX: 16 }}
                animate={{ opacity: 1, translateX: 0 }}
                exit={{ opacity: 0, translateX: -16 }}
                transition={{ type: 'timing', duration: 220 }}
                className="gap-3">
                <View className="flex-row items-center rounded-2xl border border-zinc-200 px-4 dark:border-zinc-700">
                  <Ionicons name="keypad-outline" size={18} color="#a1a1aa" />
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="123456"
                    placeholderTextColor="#a1a1aa"
                    keyboardType="number-pad"
                    autoComplete="sms-otp"
                    className="flex-1 py-3 pl-3 text-base tracking-[4px] text-zinc-900 dark:text-white"
                  />
                </View>
                <Pressable
                  onPress={() => {
                    setConfirmation(null);
                    setCode('');
                    setError(null);
                  }}>
                  <Text className="text-center text-sm font-medium text-accent">Use a different number</Text>
                </Pressable>
              </MotiView>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error ? (
              <MotiText
                key="error"
                from={{ opacity: 0, translateY: -6 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'timing', duration: 200 }}
                className="text-sm text-red-500">
                {error}
              </MotiText>
            ) : null}
          </AnimatePresence>

          <Pressable
            onPress={primaryAction}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            disabled={primaryDisabled}>
            <MotiView
              animate={{ scale: pressed ? 0.97 : 1 }}
              transition={{ type: 'timing', duration: 100 }}
              className="items-center rounded-2xl bg-accent px-4 py-4"
              style={{ opacity: primaryDisabled ? 0.5 : 1 }}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">{primaryLabel}</Text>
              )}
            </MotiView>
          </Pressable>
        </MotiView>
      </View>
    </SafeAreaView>
  );
}
