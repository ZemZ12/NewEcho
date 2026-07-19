import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Channel, MessageResponse } from 'stream-chat';

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

function isOtherOnline(channel: Channel, currentUserId: string): boolean {
  const others = Object.values(channel.state.members).filter((member) => member.user?.id !== currentUserId);
  return others.length === 1 && !!others[0].user?.online;
}

export default function ChatListScreen() {
  const { user } = useAuth();
  const { client } = useStreamChat();
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MessageResponse[]>([]);
  const [searching, setSearching] = useState(false);

  const loadChannels = useCallback(async () => {
    if (!client || !client.userID) return;
    const result = await client.queryChannels(
      { members: { $in: [client.userID] } },
      { last_message_at: -1 },
      { watch: true, state: true, presence: true },
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
      client.on('user.presence.changed', loadChannels),
    ];
    return () => handlers.forEach((handler) => handler.unsubscribe());
  }, [client, loadChannels]);

  useEffect(() => {
    if (!client || !searchVisible) return;
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    client
      .search({ members: { $in: [client.userID ?? ''] } }, query, { limit: 20 })
      .then((result) => {
        if (!cancelled) setSearchResults(result.results.map((entry) => entry.message));
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, searchQuery, searchVisible]);

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

  function openSearchResult(message: MessageResponse) {
    const channelId = message.cid?.split(':')[1];
    if (!channelId) return;
    setSearchVisible(false);
    setSearchQuery('');
    router.push(`/chat/${channelId}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Text className="text-3xl font-semibold text-zinc-900 dark:text-white">Echo</Text>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => setSearchVisible(true)} className="h-10 w-10 items-center justify-center">
            <Ionicons name="search-outline" size={24} color="#6366f1" />
          </Pressable>
          <Link href="/new-group" className="h-10 w-10 items-center justify-center">
            <Ionicons name="add" size={28} color="#6366f1" />
          </Link>
        </View>
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
          renderItem={({ item: channel }) => {
            const muted = channel.muteStatus().muted;
            const online = user ? isOtherOnline(channel, user.uid) : false;
            return (
              <Pressable
                onPress={() => router.push(`/chat/${channel.id}`)}
                onLongPress={() => handleDelete(channel)}
                className="flex-row items-center gap-3 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                {online ? <View className="h-2.5 w-2.5 rounded-full bg-green-500" /> : null}
                <View className="flex-1">
                  <Text className="text-base font-medium text-zinc-900 dark:text-white" numberOfLines={1}>
                    {channelDisplayName(channel, user?.uid ?? '')}
                  </Text>
                  <Text className="text-sm text-zinc-400 dark:text-zinc-500" numberOfLines={1}>
                    {lastMessagePreview(channel)}
                  </Text>
                </View>
                {muted ? <Ionicons name="notifications-off-outline" size={16} color="#a1a1aa" /> : null}
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={searchVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSearchVisible(false)}>
        <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
          <View className="flex-row items-center gap-3 px-5 pb-2 pt-4">
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search messages"
              placeholderTextColor="#a1a1aa"
              autoFocus
              className="flex-1 rounded-2xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
            />
            <Pressable
              onPress={() => {
                setSearchVisible(false);
                setSearchQuery('');
              }}
              hitSlop={8}>
              <Text className="text-base font-medium text-accent">Cancel</Text>
            </Pressable>
          </View>

          {searching ? <ActivityIndicator className="mt-4" /> : null}

          <FlatList
            data={searchResults}
            keyExtractor={(message) => message.id}
            contentContainerClassName="px-5"
            renderItem={({ item: message }) => (
              <Pressable onPress={() => openSearchResult(message)} className="border-b border-zinc-100 py-3 dark:border-zinc-800">
                <Text className="text-sm font-medium text-zinc-900 dark:text-white">{message.user?.name ?? message.user?.id}</Text>
                <Text className="text-sm text-zinc-500 dark:text-zinc-400" numberOfLines={2}>
                  {message.text}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              searchQuery.trim() && !searching ? (
                <Text className="mt-4 text-center text-sm text-zinc-400 dark:text-zinc-500">No messages found.</Text>
              ) : null
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
