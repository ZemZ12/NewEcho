import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { createCommunity } from '@/lib/communities';
import { MUTED_LIGHT } from '@/lib/colors';

export default function NewCommunityScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!user) return;
    setError(null);
    setCreating(true);
    try {
      const communityId = await createCommunity(user.uid, name, description);
      router.replace({ pathname: '/communities/[id]', params: { id: communityId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the community.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <Stack.Screen options={{ title: 'New Community', presentation: 'modal' }} />
      <View className="flex-1 gap-4 px-5 pt-4">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Community name"
          placeholderTextColor={MUTED_LIGHT}
          maxLength={40}
          className="rounded-2xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What's this community about?"
          placeholderTextColor={MUTED_LIGHT}
          multiline
          maxLength={200}
          className="min-h-[80px] rounded-2xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
          textAlignVertical="top"
        />
        {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
        <Pressable
          onPress={handleCreate}
          disabled={creating || name.trim().length < 3}
          className="items-center rounded-full bg-accent px-4 py-3 disabled:opacity-50">
          {creating ? <ActivityIndicator color="#fff" /> : <Text className="font-medium text-white">Create</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
