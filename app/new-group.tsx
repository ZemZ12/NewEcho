import firestore from '@react-native-firebase/firestore';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { useStreamChat } from '@/hooks/useStreamChat';

const MAX_GROUP_SIZE = 15;
// Highest valid Unicode code point, used as a prefix-range upper bound for
// Firestore "starts with" queries (there's no native startsWith operator).
const PREFIX_RANGE_END = String.fromCharCode(0xf8ff);

type UserResult = { uid: string; username: string };

// Friend picker by username (never phone number) — search Firestore's
// public users collection, pick up to MAX_GROUP_SIZE - 1 others, create a
// Stream channel with everyone as members.
export default function NewGroupScreen() {
  const { user } = useAuth();
  const { client } = useStreamChat();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    firestore()
      .collection('users')
      .where('usernameLower', '>=', query)
      .where('usernameLower', '<=', query + PREFIX_RANGE_END)
      .limit(10)
      .get()
      .then((snapshot) => {
        if (cancelled) return;
        const selectedIds = new Set(selected.map((member) => member.uid));
        const rows = snapshot.docs
          .map((docSnap) => ({ uid: docSnap.id, username: (docSnap.data().username as string) ?? docSnap.id }))
          .filter((row) => row.uid !== user?.uid && !selectedIds.has(row.uid));
        setResults(rows);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, selected, user]);

  function addMember(member: UserResult) {
    if (selected.length >= MAX_GROUP_SIZE - 1) return;
    setSelected((prev) => [...prev, member]);
    setResults((prev) => prev.filter((row) => row.uid !== member.uid));
    setSearch('');
  }

  function removeMember(uid: string) {
    setSelected((prev) => prev.filter((member) => member.uid !== uid));
  }

  async function handleCreate() {
    if (!client || !user || selected.length === 0) return;
    setError(null);
    setCreating(true);
    try {
      const channel = client.channel('messaging', {
        members: [user.uid, ...selected.map((member) => member.uid)],
      });
      await channel.create();
      router.replace(`/chat/${channel.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the group.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <Stack.Screen options={{ title: 'New Group', presentation: 'modal' }} />
      <View className="flex-1 gap-4 px-5 pt-4">
        {selected.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {selected.map((member) => (
              <Pressable
                key={member.uid}
                onPress={() => removeMember(member.uid)}
                className="flex-row items-center gap-1 rounded-full bg-accent/10 px-3 py-1.5">
                <Text className="text-sm font-medium text-accent">{member.username}</Text>
                <Text className="text-sm text-accent">×</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by username"
          placeholderTextColor="#a1a1aa"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
        />

        {searching ? <ActivityIndicator /> : null}

        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <Pressable onPress={() => addMember(item)} className="border-b border-zinc-100 py-3 dark:border-zinc-800">
              <Text className="text-base text-zinc-900 dark:text-white">{item.username}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            search.trim() && !searching ? (
              <Text className="py-4 text-center text-sm text-zinc-400 dark:text-zinc-500">No users found.</Text>
            ) : null
          }
        />

        {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

        <Pressable
          onPress={handleCreate}
          disabled={creating || selected.length === 0 || !client}
          className="mb-4 items-center rounded-full bg-accent px-4 py-3 disabled:opacity-50">
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-medium text-white">Create {selected.length > 1 ? 'Group' : 'Chat'}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
