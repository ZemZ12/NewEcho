import { getApp } from '@react-native-firebase/app';
import { getAuth, signInWithPhoneNumber, type ConfirmationResult } from '@react-native-firebase/auth';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phone OTP entry, wired to Firebase Auth. Signing in updates the auth state
// listened to by the root layout, which then redirects out of this screen.
export default function OnboardingScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center gap-4 px-10">
        <Text className="text-2xl font-semibold text-zinc-900 dark:text-white">Welcome to Echo</Text>

        {!confirmation ? (
          <View className="gap-4">
            <Text className="text-base text-zinc-400 dark:text-zinc-500">
              Enter your phone number to get started.
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 123 4567"
              placeholderTextColor="#a1a1aa"
              keyboardType="phone-pad"
              autoComplete="tel"
              className="rounded-xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
            />
            {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
            <Pressable
              onPress={handleSendCode}
              disabled={loading || !phone}
              className="items-center rounded-full bg-accent px-4 py-3 disabled:opacity-50">
              {loading ? <ActivityIndicator color="#fff" /> : <Text className="font-medium text-white">Send code</Text>}
            </Pressable>
          </View>
        ) : (
          <View className="gap-4">
            <Text className="text-base text-zinc-400 dark:text-zinc-500">
              Enter the code we sent to {phone.trim()}.
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor="#a1a1aa"
              keyboardType="number-pad"
              autoComplete="sms-otp"
              className="rounded-xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
            />
            {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
            <Pressable
              onPress={handleConfirmCode}
              disabled={loading || code.length < 6}
              className="items-center rounded-full bg-accent px-4 py-3 disabled:opacity-50">
              {loading ? <ActivityIndicator color="#fff" /> : <Text className="font-medium text-white">Verify</Text>}
            </Pressable>
            <Pressable
              onPress={() => {
                setConfirmation(null);
                setCode('');
                setError(null);
              }}>
              <Text className="text-center text-sm text-accent">Use a different number</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
