import firestore from '@react-native-firebase/firestore';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStreamChat } from '@/hooks/useStreamChat';
import type { Community } from '@/lib/communities';

export default function NewChannelScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const { client } = useStreamChat();
  const router = useRouter();

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!client || !communityId) return;
    setError(null);
    setCreating(true);
    try {
      const communityDoc = await firestore().collection('communities').doc(communityId).get();
      const community = communityDoc.data() as Community | undefined;
      if (!community) throw new Error('Community not found.');

      const channelId = `${communityId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const channel = client.channel('team', channelId, {
        name: name.trim(),
        team: communityId,
        members: community.memberIds,
      });
      await channel.create();
      router.replace({ pathname: '/chat/[id]', params: { id: channel.id!, type: 'team' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the channel.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <Stack.Screen options={{ title: 'New Channel', presentation: 'modal' }} />
      <View className="flex-1 gap-4 px-5 pt-4">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Channel name, e.g. options"
          placeholderTextColor="#a1a1aa"
          autoCapitalize="none"
          maxLength={40}
          className="rounded-2xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
        />
        {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
        <Pressable
          onPress={handleCreate}
          disabled={creating || name.trim().length < 2 || !client}
          className="items-center rounded-full bg-accent px-4 py-3 disabled:opacity-50">
          {creating ? <ActivityIndicator color="#fff" /> : <Text className="font-medium text-white">Create</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
