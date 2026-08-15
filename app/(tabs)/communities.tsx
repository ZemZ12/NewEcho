import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import type { Community } from '@/lib/communities';
import { PREFIX_RANGE_END } from '@/lib/firestoreSearch';

export default function CommunitiesScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Community[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    return firestore()
      .collection('communities')
      .where('memberIds', 'array-contains', user.uid)
      .onSnapshot(
        (snapshot) => {
          setMyCommunities(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Community, 'id'>) })));
          setLoadError(false);
          setLoading(false);
        },
        (err) => {
          console.warn('Could not load communities:', err);
          setLoadError(true);
          setLoading(false);
        },
      );
  }, [user]);

  useEffect(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    firestore()
      .collection('communities')
      .where('nameLower', '>=', query)
      .where('nameLower', '<=', query + PREFIX_RANGE_END)
      .limit(15)
      .get()
      .then((snapshot) => {
        if (cancelled) return;
        const myIds = new Set(myCommunities.map((community) => community.id));
        const rows = snapshot.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Community, 'id'>) }))
          .filter((community) => !myIds.has(community.id));
        setSearchResults(rows);
      })
      .catch((err) => console.warn('Could not search communities:', err))
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, myCommunities]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Text className="text-3xl font-semibold text-zinc-900 dark:text-white">Communities</Text>
        <Link href="/communities/new" className="h-10 w-10 items-center justify-center">
          <Ionicons name="add" size={28} color="#6366f1" />
        </Link>
      </View>

      <View className="px-5 pb-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Find a community"
          placeholderTextColor="#a1a1aa"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-2xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
        />
      </View>

      {search.trim() ? (
        <>
          {searching ? <ActivityIndicator className="mt-2" /> : null}
          <FlatList
            data={searchResults}
            keyExtractor={(community) => community.id}
            contentContainerClassName="px-5"
            renderItem={({ item: community }) => (
              <Pressable
                onPress={() => router.push({ pathname: '/communities/[id]', params: { id: community.id } })}
                className="border-b border-zinc-100 py-3 dark:border-zinc-800">
                <Text className="text-base font-medium text-zinc-900 dark:text-white">{community.name}</Text>
                <Text className="text-sm text-zinc-400 dark:text-zinc-500" numberOfLines={1}>
                  {community.description || `${community.memberIds.length} members`}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              !searching ? (
                <Text className="mt-4 text-center text-sm text-zinc-400 dark:text-zinc-500">No communities found.</Text>
              ) : null
            }
          />
        </>
      ) : loadError ? (
        <View className="flex-1 items-center justify-center gap-3 px-10">
          <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">
            Could not load your communities. Check your connection and try again.
          </Text>
        </View>
      ) : !loading && myCommunities.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 px-10">
          <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">
            You are not in any communities yet. Search above or create one.
          </Text>
        </View>
      ) : (
        <FlatList
          data={myCommunities}
          keyExtractor={(community) => community.id}
          contentContainerClassName="px-5"
          renderItem={({ item: community }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/communities/[id]', params: { id: community.id } })}
              className="border-b border-zinc-100 py-3 dark:border-zinc-800">
              <Text className="text-base font-medium text-zinc-900 dark:text-white">{community.name}</Text>
              <Text className="text-sm text-zinc-400 dark:text-zinc-500" numberOfLines={1}>
                {community.description || `${community.memberIds.length} members`}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
