import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { claimUsername } from '@/hooks/useProfile';

// Shown once, right after phone verification, before entering the app.
// Claiming a username here is what makes someone discoverable/addable in
// New Group — the alternative (raw phone numbers) is exactly what usernames
// are meant to avoid exposing.
export default function ChooseUsernameScreen() {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!user) return;
    setError(null);
    setLoading(true);
    const result = await claimUsername(user.uid, username);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
    }
    // On success the users/{uid} doc appears, useProfile's listener picks it
    // up, and the root layout's guard routes out of this screen on its own.
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center gap-4 px-10">
        <Text className="text-2xl font-semibold text-zinc-900 dark:text-white">Choose a username</Text>
        <Text className="text-base text-zinc-400 dark:text-zinc-500">
          This is how friends find and add you — your phone number stays private.
        </Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="username"
          placeholderTextColor="#a1a1aa"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          className="rounded-xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
        />
        {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
        <Pressable
          onPress={handleSubmit}
          disabled={loading || username.trim().length < 3}
          className="items-center rounded-full bg-accent px-4 py-3 disabled:opacity-50">
          {loading ? <ActivityIndicator color="#fff" /> : <Text className="font-medium text-white">Continue</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
