import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Channel, LocalMessage } from 'stream-chat';

import { useAuth } from '@/hooks/useAuth';
import { useStreamChat } from '@/hooks/useStreamChat';

// Plain message list + input for now — custom bubbles/animations land in M2.
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { client } = useStreamChat();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!client || !id) return;

    let cancelled = false;
    const ch = client.channel('messaging', id);

    ch.watch().then(() => {
      if (cancelled) return;
      setChannel(ch);
      setMessages([...ch.state.messages]);
    });

    const handler = ch.on('message.new', () => setMessages([...ch.state.messages]));

    return () => {
      cancelled = true;
      handler.unsubscribe();
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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['bottom']}>
      <Stack.Screen options={{ title: id ?? 'Chat' }} />
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
    </SafeAreaView>
  );
}
