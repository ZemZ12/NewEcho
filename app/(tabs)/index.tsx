import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Channel } from 'stream-chat';

import { useAuth } from '@/hooks/useAuth';
import { useStreamChat } from '@/hooks/useStreamChat';
import { channelDisplayName } from '@/lib/channelDisplayName';

function lastMessagePreview(channel: Channel): string {
  const messages = channel.state.messages;
  const last = messages[messages.length - 1];
  if (!last) return 'No messages yet';
  if (last.text) return last.text;
  if (last.attachments?.some((attachment) => attachment.type === 'image')) return 'Photo';
  return 'No messages yet';
}

export default function ChatListScreen() {
  const { user } = useAuth();
  const { client } = useStreamChat();
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChannels = useCallback(async () => {
    if (!client || !client.userID) return;
    const result = await client.queryChannels(
      { members: { $in: [client.userID] } },
      { last_message_at: -1 },
      { watch: true, state: true },
    );
    setChannels(result);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    if (!client) return;
    loadChannels();

    const handlers = [
      client.on('message.new', loadChannels),
      client.on('notification.added_to_channel', loadChannels),
      client.on('channel.updated', loadChannels),
    ];
    return () => handlers.forEach((handler) => handler.unsubscribe());
  }, [client, loadChannels]);

  function handleDelete(channel: Channel) {
    Alert.alert('Delete conversation?', 'It will disappear from your list until someone sends a new message.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await channel.hide();
            setChannels((prev) => prev.filter((item) => item.cid !== channel.cid));
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : undefined);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Text className="text-3xl font-semibold text-zinc-900 dark:text-white">Echo</Text>
        <Link href="/new-group" className="h-10 w-10 items-center justify-center">
          <Ionicons name="add" size={28} color="#6366f1" />
        </Link>
      </View>

      {!loading && channels.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 px-10">
          <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">
            No conversations yet. Start a chat with your friends to see it here.
          </Text>
        </View>
      ) : (
        <FlashList
          data={channels}
          keyExtractor={(channel) => channel.cid}
          renderItem={({ item: channel }) => (
            <Pressable
              onPress={() => router.push(`/chat/${channel.id}`)}
              onLongPress={() => handleDelete(channel)}
              className="flex-row items-center gap-3 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <View className="flex-1">
                <Text className="text-base font-medium text-zinc-900 dark:text-white" numberOfLines={1}>
                  {channelDisplayName(channel, user?.uid ?? '')}
                </Text>
                <Text className="text-sm text-zinc-400 dark:text-zinc-500" numberOfLines={1}>
                  {lastMessagePreview(channel)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
