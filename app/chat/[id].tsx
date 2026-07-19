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

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function presenceSubtitle(channel: Channel, currentUserId: string): string | null {
  const others = Object.values(channel.state.members).filter((member) => member.user?.id !== currentUserId);
  if (others.length !== 1) return null;
  const other = others[0].user;
  if (!other) return null;
  if (other.online) return 'Online';
  if (other.last_active) return `Last seen ${formatRelative(other.last_active)}`;
  return null;
}

function isSeenByOthers(channel: Channel, message: LocalMessage, currentUserId: string): boolean {
  const createdAt = message.created_at ? new Date(message.created_at).getTime() : 0;
  return Object.entries(channel.state.read).some(([userId, read]) => {
    if (userId === currentUserId) return false;
    return new Date(read.last_read).getTime() >= createdAt;
  });
}

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
  const [presenceTick, setPresenceTick] = useState(0);
  const [infoVisible, setInfoVisible] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<LocalMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<LocalMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<LocalMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [muted, setMuted] = useState(false);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  const title = channel && user ? channelDisplayName(channel, user.uid) : (id ?? 'Chat');
  const subtitle = channel && user ? presenceSubtitle(channel, user.uid) : null;

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

    ch.watch({ presence: true }).then(() => {
      if (cancelled) return;
      setChannel(ch);
      setMessages([...ch.state.messages]);
      setMuted(ch.muteStatus().muted);
      ch.markRead();
    });

    setBlockedIds(client.blockedUsers.getLatestValue().userIds);

    const refreshMessages = () => setMessages([...ch.state.messages]);

    const handlers = [
      ch.on('message.new', () => {
        refreshMessages();
        ch.markRead();
      }),
      ch.on('message.updated', refreshMessages),
      ch.on('message.deleted', refreshMessages),
      ch.on('reaction.new', refreshMessages),
      ch.on('reaction.updated', refreshMessages),
      ch.on('reaction.deleted', refreshMessages),
      ch.on('message.read', () => setPresenceTick((tick) => tick + 1)),
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
      client.on('user.presence.changed', () => setPresenceTick((tick) => tick + 1)),
    ];

    return () => {
      cancelled = true;
      handlers.forEach((handler) => handler.unsubscribe());
    };
  }, [client, id]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!channel || !trimmed || !client) return;
    setSending(true);
    channel.stopTyping();
    try {
      if (editingMessage) {
        await client.updateMessage({ id: editingMessage.id, text: trimmed });
        setEditingMessage(null);
      } else {
        await channel.sendMessage({ text: trimmed, quoted_message_id: replyingTo?.id });
        setReplyingTo(null);
      }
      setText('');
    } catch (err) {
      Alert.alert('Could not send', err instanceof Error ? err.message : undefined);
    } finally {
      setSending(false);
    }
  }

  function handleTextChange(value: string) {
    setText(value);
    channel?.keystroke();
  }

  function cancelComposerExtra() {
    setReplyingTo(null);
    setEditingMessage(null);
    setText('');
  }

  async function handleReactionPress(emoji: string) {
    if (!channel || !actionTarget) return;
    const alreadyReacted = actionTarget.own_reactions?.some((reaction) => reaction.type === emoji);
    setActionTarget(null);
    try {
      if (alreadyReacted) {
        await channel.deleteReaction(actionTarget.id, emoji);
      } else {
        await channel.sendReaction(actionTarget.id, { type: emoji });
      }
    } catch (err) {
      Alert.alert('Could not react', err instanceof Error ? err.message : undefined);
    }
  }

  function handleReplyPress() {
    if (!actionTarget) return;
    setEditingMessage(null);
    setReplyingTo(actionTarget);
    setActionTarget(null);
  }

  function handleEditPress() {
    if (!actionTarget) return;
    setReplyingTo(null);
    setEditingMessage(actionTarget);
    setText(actionTarget.text ?? '');
    setActionTarget(null);
  }

  function handleDeletePress() {
    if (!actionTarget || !client) return;
    const messageId = actionTarget.id;
    setActionTarget(null);
    Alert.alert('Delete message?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.deleteMessage(messageId);
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : undefined);
          }
        },
      },
    ]);
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

  async function handleToggleBlock(memberId: string) {
    if (!client) return;
    const isBlocked = blockedIds.includes(memberId);
    setBusyMemberId(memberId);
    try {
      if (isBlocked) {
        await client.unBlockUser(memberId);
        setBlockedIds((prev) => prev.filter((blockedId) => blockedId !== memberId));
      } else {
        await client.blockUser(memberId);
        setBlockedIds((prev) => [...prev, memberId]);
      }
    } catch (err) {
      Alert.alert('Could not update block', err instanceof Error ? err.message : undefined);
    } finally {
      setBusyMemberId(null);
    }
  }

  async function handleToggleMute() {
    if (!channel) return;
    try {
      if (muted) {
        await channel.unmute();
      } else {
        await channel.mute();
      }
      setMuted(!muted);
    } catch (err) {
      Alert.alert('Could not update mute', err instanceof Error ? err.message : undefined);
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
  const lastMessage = messages[messages.length - 1];
  const isActionTargetMine = actionTarget?.user?.id === user?.uid;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['bottom']}>
      <Stack.Screen
        options={{
          title,
          headerTitle: () => (
            <View className="items-center">
              <Text className="text-base font-semibold text-zinc-900 dark:text-white" numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text className="text-xs text-zinc-400 dark:text-zinc-500" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ),
          headerRight: () => (
            <Pressable onPress={() => setInfoVisible(true)} hitSlop={8}>
              <Ionicons name="information-circle-outline" size={26} color="#6366f1" />
            </Pressable>
          ),
        }}
      />
      <View className="flex-1" style={{ paddingBottom: keyboardHeight }} key={presenceTick}>
        <FlatList
          data={messages}
          keyExtractor={(message) => message.id}
          contentContainerClassName="gap-2 px-4 py-3"
          renderItem={({ item: message }) => {
            const isMine = message.user?.id === user?.uid;
            const images = (message.attachments ?? []).filter((attachment) => attachment.type === 'image');
            const reactionEntries = Object.entries(message.reaction_counts ?? {}).filter(([, count]) => count > 0);
            const showSeen = isMine && channel && message.id === lastMessage?.id && isSeenByOthers(channel, message, user?.uid ?? '');
            return (
              <Pressable onLongPress={() => setActionTarget(message)} className={isMine ? 'items-end' : 'items-start'}>
                {message.quoted_message ? (
                  <View className="mb-1 max-w-[80%] rounded-xl border-l-2 border-accent bg-black/5 px-2 py-1 dark:bg-white/5">
                    <Text className="text-xs text-zinc-500 dark:text-zinc-400" numberOfLines={1}>
                      {message.quoted_message.text || 'Photo'}
                    </Text>
                  </View>
                ) : null}
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
                {message.updated_at !== message.created_at ? (
                  <Text className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">edited</Text>
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
                {showSeen ? <Text className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">Seen</Text> : null}
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

        {replyingTo || editingMessage ? (
          <View className="flex-row items-center justify-between border-t border-zinc-100 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
            <View className="flex-1">
              <Text className="text-xs font-medium text-accent">
                {editingMessage ? 'Editing message' : `Replying to ${replyingTo?.user?.name ?? ''}`}
              </Text>
              {replyingTo ? (
                <Text className="text-sm text-zinc-500 dark:text-zinc-400" numberOfLines={1}>
                  {replyingTo.text || 'Photo'}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={cancelComposerExtra} hitSlop={8}>
              <Ionicons name="close" size={20} color="#71717a" />
            </Pressable>
          </View>
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
            <Text className="font-medium text-white">{editingMessage ? 'Save' : 'Send'}</Text>
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

          <Pressable onPress={handleToggleMute} className="mx-5 mb-2 flex-row items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
            <Text className="text-base text-zinc-900 dark:text-white">Mute notifications</Text>
            <Ionicons name={muted ? 'notifications-off' : 'notifications-outline'} size={20} color={muted ? '#ef4444' : '#71717a'} />
          </Pressable>

          <FlatList
            data={members}
            keyExtractor={(member) => member.user?.id ?? Math.random().toString()}
            contentContainerClassName="px-5"
            renderItem={({ item: member }) => {
              const isSelf = member.user?.id === user?.uid;
              const isBlocked = member.user?.id ? blockedIds.includes(member.user.id) : false;
              return (
                <View className="flex-row items-center justify-between border-b border-zinc-100 py-3 dark:border-zinc-800">
                  <Text className="text-base text-zinc-900 dark:text-white">
                    {member.user?.name ?? member.user?.id}
                    {isSelf ? ' (you)' : ''}
                  </Text>
                  {!isSelf ? (
                    <View className="flex-row items-center gap-4">
                      <Pressable
                        onPress={() => handleToggleBlock(member.user!.id)}
                        disabled={busyMemberId === member.user?.id}
                        hitSlop={8}>
                        <Text className="text-sm font-medium text-accent">{isBlocked ? 'Unblock' : 'Block'}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRemoveMember(member.user!.id)}
                        disabled={busyMemberId === member.user?.id}
                        hitSlop={8}>
                        <Text className="text-sm font-medium text-red-500">Remove</Text>
                      </Pressable>
                    </View>
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

      <Modal visible={!!actionTarget} transparent animationType="fade" onRequestClose={() => setActionTarget(null)}>
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-8" onPress={() => setActionTarget(null)}>
          <Pressable className="w-full gap-1 rounded-2xl bg-white p-3 dark:bg-zinc-800" onPress={(event) => event.stopPropagation()}>
            <View className="flex-row justify-center gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-700">
              {REACTION_EMOJIS.map((emoji) => (
                <Pressable key={emoji} onPress={() => handleReactionPress(emoji)} hitSlop={6}>
                  <Text className="text-2xl">{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={handleReplyPress} className="flex-row items-center gap-3 rounded-xl px-3 py-3">
              <Ionicons name="arrow-undo-outline" size={20} color="#71717a" />
              <Text className="text-base text-zinc-900 dark:text-white">Reply</Text>
            </Pressable>
            {isActionTargetMine ? (
              <>
                <Pressable onPress={handleEditPress} className="flex-row items-center gap-3 rounded-xl px-3 py-3">
                  <Ionicons name="create-outline" size={20} color="#71717a" />
                  <Text className="text-base text-zinc-900 dark:text-white">Edit</Text>
                </Pressable>
                <Pressable onPress={handleDeletePress} className="flex-row items-center gap-3 rounded-xl px-3 py-3">
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  <Text className="text-base text-red-500">Delete</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
