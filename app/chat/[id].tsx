import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Channel, LocalMessage } from 'stream-chat';

import { useAuth } from '@/hooks/useAuth';
import { useStreamChat } from '@/hooks/useStreamChat';
import { channelDisplayName } from '@/lib/channelDisplayName';
import { pickImageFromCamera, pickImageFromLibrary } from '@/lib/pickImage';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

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
  const [sendingImage, setSendingImage] = useState(false);
  const [memberTick, setMemberTick] = useState(0);
  const [infoVisible, setInfoVisible] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [reactionTarget, setReactionTarget] = useState<LocalMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const title = channel && user ? channelDisplayName(channel, user.uid) : (id ?? 'Chat');

  // Tracked manually rather than via KeyboardAvoidingView: on this
  // Expo/Android edge-to-edge setup neither KeyboardAvoidingView's
  // automatic behavior nor windowSoftInputMode=resize actually shifted
  // the input above the keyboard, so the height is applied as explicit
  // bottom padding instead.
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!client || !id) return;

    let cancelled = false;
    const ch = client.channel('messaging', id);

    ch.watch().then(() => {
      if (cancelled) return;
      setChannel(ch);
      setMessages([...ch.state.messages]);
    });

    const refreshMessages = () => setMessages([...ch.state.messages]);

    const handlers = [
      ch.on('message.new', refreshMessages),
      ch.on('reaction.new', refreshMessages),
      ch.on('reaction.updated', refreshMessages),
      ch.on('reaction.deleted', refreshMessages),
      ch.on('member.added', () => setMemberTick((tick) => tick + 1)),
      ch.on('member.removed', () => setMemberTick((tick) => tick + 1)),
      ch.on('typing.start', (event) => {
        if (event.user?.id === client.userID || !event.user?.name) return;
        setTypingUsers((prev) => (prev.includes(event.user!.name!) ? prev : [...prev, event.user!.name!]));
      }),
      ch.on('typing.stop', (event) => {
        if (!event.user?.name) return;
        setTypingUsers((prev) => prev.filter((name) => name !== event.user!.name));
      }),
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
    channel.stopTyping();
    try {
      await channel.sendMessage({ text: trimmed });
    } finally {
      setSending(false);
    }
  }

  function handleTextChange(value: string) {
    setText(value);
    channel?.keystroke();
  }

  async function handleReactionPress(emoji: string) {
    if (!channel || !reactionTarget) return;
    const alreadyReacted = reactionTarget.own_reactions?.some((reaction) => reaction.type === emoji);
    setReactionTarget(null);
    try {
      if (alreadyReacted) {
        await channel.deleteReaction(reactionTarget.id, emoji);
      } else {
        await channel.sendReaction(reactionTarget.id, { type: emoji });
      }
    } catch (err) {
      Alert.alert('Could not react', err instanceof Error ? err.message : undefined);
    }
  }

  function handleAttach() {
    Alert.alert('Send photo', undefined, [
      { text: 'Take photo', onPress: () => sendPhotoFrom(pickImageFromCamera) },
      { text: 'Choose from library', onPress: () => sendPhotoFrom(pickImageFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function sendPhotoFrom(pick: () => Promise<{ uri: string; fileName: string | null } | null>) {
    if (!channel) return;
    const image = await pick();
    if (!image) return;

    setSendingImage(true);
    try {
      const result = await channel.sendImage(image.uri, image.fileName ?? undefined);
      await channel.sendMessage({ attachments: [{ type: 'image', image_url: result.file }] });
    } catch (err) {
      Alert.alert('Could not send photo', err instanceof Error ? err.message : undefined);
    } finally {
      setSendingImage(false);
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
      <View className="flex-1" style={{ paddingBottom: keyboardHeight }}>
        <FlatList
          data={messages}
          keyExtractor={(message) => message.id}
          contentContainerClassName="gap-2 px-4 py-3"
          renderItem={({ item: message }) => {
            const isMine = message.user?.id === user?.uid;
            const images = (message.attachments ?? []).filter((attachment) => attachment.type === 'image');
            const reactionEntries = Object.entries(message.reaction_counts ?? {}).filter(([, count]) => count > 0);
            return (
              <Pressable onLongPress={() => setReactionTarget(message)} className={isMine ? 'items-end' : 'items-start'}>
                {images.map((attachment, index) => (
                  <Image
                    key={attachment.image_url ?? index}
                    source={{ uri: attachment.image_url }}
                    style={{ width: 200, height: 200, borderRadius: 16, marginBottom: message.text ? 4 : 0 }}
                    contentFit="cover"
                  />
                ))}
                {message.text ? (
                  <View className={`max-w-[80%] rounded-2xl px-4 py-2 ${isMine ? 'bg-accent' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                    <Text className={isMine ? 'text-white' : 'text-zinc-900 dark:text-white'}>{message.text}</Text>
                  </View>
                ) : null}
                {reactionEntries.length > 0 ? (
                  <View className="mt-1 flex-row gap-1">
                    {reactionEntries.map(([type, count]) => (
                      <View key={type} className="flex-row items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                        <Text className="text-xs">
                          {type} {count}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text className="mt-10 text-center text-base text-zinc-400 dark:text-zinc-500">
              No messages yet. Say hello.
            </Text>
          }
        />

        {typingUsers.length > 0 ? (
          <Text className="px-4 pb-1 text-xs text-zinc-400 dark:text-zinc-500">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </Text>
        ) : null}

        <View className="flex-row items-center gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <Pressable
            onPress={handleAttach}
            disabled={sendingImage || !channel}
            className="items-center justify-center rounded-full bg-zinc-100 p-2 disabled:opacity-50 dark:bg-zinc-800">
            {sendingImage ? <ActivityIndicator /> : <Ionicons name="image-outline" size={22} color="#6366f1" />}
          </Pressable>
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message"
            placeholderTextColor="#a1a1aa"
            className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            style={{ maxHeight: 120 }}
            textAlignVertical="top"
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !text.trim() || !channel}
            className="items-center justify-center rounded-full bg-accent px-4 py-2 disabled:opacity-50">
            <Text className="font-medium text-white">Send</Text>
          </Pressable>
        </View>
      </View>

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

      <Modal visible={!!reactionTarget} transparent animationType="fade" onRequestClose={() => setReactionTarget(null)}>
        <Pressable className="flex-1 items-center justify-center bg-black/40" onPress={() => setReactionTarget(null)}>
          <View className="flex-row gap-3 rounded-full bg-white px-5 py-3 dark:bg-zinc-800">
            {REACTION_EMOJIS.map((emoji) => (
              <Pressable key={emoji} onPress={() => handleReactionPress(emoji)} hitSlop={6}>
                <Text className="text-3xl">{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
