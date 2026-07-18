import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Channel, LocalMessage } from 'stream-chat';

import { useAuth } from '@/hooks/useAuth';
import { useStreamChat } from '@/hooks/useStreamChat';
import { channelDisplayName } from '@/lib/channelDisplayName';

// Plain message list + input for now — custom bubbles/animations land in M2.
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { client } = useStreamChat();
  const router = useRouter();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [memberTick, setMemberTick] = useState(0);
  const [infoVisible, setInfoVisible] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const title = channel && user ? channelDisplayName(channel, user.uid) : (id ?? 'Chat');

  useEffect(() => {
    if (!client || !id) return;

    let cancelled = false;
    const ch = client.channel('messaging', id);

    ch.watch().then(() => {
      if (cancelled) return;
      setChannel(ch);
      setMessages([...ch.state.messages]);
    });

    const handlers = [
      ch.on('message.new', () => setMessages([...ch.state.messages])),
      ch.on('member.added', () => setMemberTick((tick) => tick + 1)),
      ch.on('member.removed', () => setMemberTick((tick) => tick + 1)),
    ];

    return () => {
      cancelled = true;
      handlers.forEach((handler) => handler.unsubscribe());
    };
  }, [client, id]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!channel || !trimmed) return;
    setSending(true);
    setText('');
    try {
      await channel.sendMessage({ text: trimmed });
    } finally {
      setSending(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!channel) return;
    setBusyMemberId(memberId);
    try {
      await channel.removeMembers([memberId]);
    } catch (err) {
      Alert.alert('Could not remove member', err instanceof Error ? err.message : undefined);
    } finally {
      setBusyMemberId(null);
    }
  }

  function handleLeaveGroup() {
    if (!channel || !user) return;
    Alert.alert('Leave conversation?', 'You will stop receiving new messages here.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await channel.removeMembers([user.uid]);
            setInfoVisible(false);
            router.replace('/');
          } catch (err) {
            Alert.alert('Could not leave', err instanceof Error ? err.message : undefined);
          }
        },
      },
    ]);
  }

  const members = channel ? Object.values(channel.state.members) : [];

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['bottom']}>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable onPress={() => setInfoVisible(true)} hitSlop={8}>
              <Ionicons name="information-circle-outline" size={26} color="#6366f1" />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <FlatList
          data={messages}
          keyExtractor={(message) => message.id}
          contentContainerClassName="gap-2 px-4 py-3"
          renderItem={({ item: message }) => {
            const isMine = message.user?.id === user?.uid;
            return (
              <View className={isMine ? 'items-end' : 'items-start'}>
                <View className={`max-w-[80%] rounded-2xl px-4 py-2 ${isMine ? 'bg-accent' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                  <Text className={isMine ? 'text-white' : 'text-zinc-900 dark:text-white'}>{message.text}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text className="mt-10 text-center text-base text-zinc-400 dark:text-zinc-500">
              No messages yet. Say hello.
            </Text>
          }
        />

        <View className="flex-row items-center gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor="#a1a1aa"
            className="flex-1 rounded-full border border-zinc-200 px-4 py-2 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !text.trim() || !channel}
            className="items-center justify-center rounded-full bg-accent px-4 py-2 disabled:opacity-50">
            <Text className="font-medium text-white">Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={infoVisible} animationType="slide" presentationStyle="pageSheet" key={memberTick}>
        <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
          <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
            <Text className="text-2xl font-semibold text-zinc-900 dark:text-white">Members</Text>
            <Pressable onPress={() => setInfoVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={26} color="#71717a" />
            </Pressable>
          </View>

          <FlatList
            data={members}
            keyExtractor={(member) => member.user?.id ?? Math.random().toString()}
            contentContainerClassName="px-5"
            renderItem={({ item: member }) => {
              const isSelf = member.user?.id === user?.uid;
              return (
                <View className="flex-row items-center justify-between border-b border-zinc-100 py-3 dark:border-zinc-800">
                  <Text className="text-base text-zinc-900 dark:text-white">
                    {member.user?.name ?? member.user?.id}
                    {isSelf ? ' (you)' : ''}
                  </Text>
                  {!isSelf ? (
                    <Pressable
                      onPress={() => handleRemoveMember(member.user!.id)}
                      disabled={busyMemberId === member.user?.id}
                      hitSlop={8}>
                      <Text className="text-sm font-medium text-red-500">Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            }}
          />

          <View className="px-5 pb-4 pt-2">
            <Pressable onPress={handleLeaveGroup} className="items-center rounded-full bg-red-500 px-4 py-3">
              <Text className="font-medium text-white">Leave conversation</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
