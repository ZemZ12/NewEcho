import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Channel } from 'stream-chat';

import { useAuth } from '@/hooks/useAuth';
import { useRubberBandList } from '@/hooks/useRubberBandList';
import { useStreamChat } from '@/hooks/useStreamChat';
import { joinCommunityDoc, leaveCommunityDoc, type Community } from '@/lib/communities';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as typeof FlatList;

export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { client } = useStreamChat();
  const router = useRouter();

  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const { listRef, gesture, bounceStyle, onScroll, onContentSizeChange, onLayout } = useRubberBandList();

  const isMember = !!(user && community?.memberIds.includes(user.uid));

  useEffect(() => {
    if (!id) return;
    return firestore()
      .collection('communities')
      .doc(id)
      .onSnapshot(
        (snapshot) => {
          setCommunity(snapshot.exists() ? ({ id: snapshot.id, ...(snapshot.data() as Omit<Community, 'id'>) }) : null);
          setLoading(false);
        },
        (err) => {
          console.warn('Could not load community:', err);
          setLoading(false);
        },
      );
  }, [id]);

  const loadChannels = useCallback(async () => {
    if (!client || !id || !isMember) {
      setChannelsLoading(false);
      return;
    }
    setChannelsLoading(true);
    try {
      const result = await client.queryChannels(
        { type: 'team', team: id },
        { last_message_at: -1 },
        { watch: true, state: true },
      );
      setChannels(result);
    } catch (err) {
      console.warn('Could not load channels:', err);
    } finally {
      setChannelsLoading(false);
    }
  }, [client, id, isMember]);

  useEffect(() => {
    if (!client || !isMember) return;
    const handler = client.on('notification.added_to_channel', loadChannels);
    return () => {
      handler.unsubscribe();
    };
  }, [client, isMember, loadChannels]);

  useFocusEffect(
    useCallback(() => {
      loadChannels();
    }, [loadChannels]),
  );

  async function handleJoin() {
    if (!user || !community || !client) return;
    setJoining(true);
    try {
      await joinCommunityDoc(community.id, user.uid);
      const existingChannels = await client.queryChannels({ type: 'team', team: community.id });
      await Promise.all(existingChannels.map((channel) => channel.addMembers([user.uid])));
    } catch (err) {
      Alert.alert('Could not join', err instanceof Error ? err.message : undefined);
    } finally {
      setJoining(false);
    }
  }

  function handleLeave() {
    if (!user || !community) return;
    Alert.alert('Leave community?', 'You will be removed from all of its channels.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveCommunityDoc(community.id, user.uid);
            if (client) {
              const existingChannels = await client.queryChannels({ type: 'team', team: community.id });
              await Promise.all(existingChannels.map((channel) => channel.removeMembers([user.uid])));
            }
            router.replace('/communities');
          } catch (err) {
            Alert.alert('Could not leave', err instanceof Error ? err.message : undefined);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-surface-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!community) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-10 dark:bg-surface-dark">
        <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">This community no longer exists.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: community.name,
          headerRight: isMember
            ? () => (
                <View className="flex-row items-center gap-4">
                  <Link href={{ pathname: '/new-channel', params: { communityId: community.id } }}>
                    <Ionicons name="add" size={26} color="#6366f1" />
                  </Link>
                  <Pressable onPress={() => setMenuVisible(true)} hitSlop={8}>
                    <Ionicons name="ellipsis-horizontal" size={22} color="#71717a" />
                  </Pressable>
                </View>
              )
            : undefined,
        }}
      />

      {community.description ? (
        <Text className="px-5 pb-2 pt-4 text-sm text-zinc-400 dark:text-zinc-500">{community.description}</Text>
      ) : null}

      {!isMember ? (
        <View className="flex-1 items-center justify-center gap-3 px-10">
          <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">
            Join {community.name} to see its channels and chat.
          </Text>
          <Pressable onPress={handleJoin} disabled={joining} className="rounded-full bg-accent px-4 py-3 disabled:opacity-50">
            {joining ? <ActivityIndicator color="#fff" /> : <Text className="font-medium text-white">Join</Text>}
          </Pressable>
        </View>
      ) : channelsLoading ? (
        <ActivityIndicator className="mt-4" />
      ) : channels.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 px-10">
          <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">
            No channels yet. Tap + to create the first one.
          </Text>
        </View>
      ) : (
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ flex: 1 }, bounceStyle]}>
            <AnimatedFlatList
              ref={listRef}
              data={channels}
              keyExtractor={(channel) => channel.cid}
              contentContainerClassName="px-5 pt-2"
              onScroll={onScroll}
              scrollEventThrottle={16}
              onContentSizeChange={onContentSizeChange}
              onLayout={onLayout}
              renderItem={({ item: channel }) => (
                <Pressable
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: channel.id!, type: 'team' } })}
                  className="flex-row items-center gap-2 border-b border-zinc-100 py-3 dark:border-zinc-800">
                  <Ionicons name="pricetag-outline" size={16} color="#a1a1aa" />
                  <Text className="text-base text-zinc-900 dark:text-white">{channel.data?.name ?? channel.id}</Text>
                </Pressable>
              )}
            />
          </Animated.View>
        </GestureDetector>
      )}

      <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setMenuVisible(false)}>
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={['bottom']} className="rounded-t-3xl bg-white dark:bg-surface-dark">
              <View className="items-center pt-2">
                <View className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              </View>
              <Pressable
                onPress={() => {
                  setMenuVisible(false);
                  handleLeave();
                }}
                className="flex-row items-center gap-3 px-5 py-4">
                <Ionicons name="exit-outline" size={20} color="#ef4444" />
                <Text className="text-base font-medium text-red-500">Leave community</Text>
              </Pressable>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
