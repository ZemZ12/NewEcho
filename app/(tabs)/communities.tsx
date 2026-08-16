import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useRubberBandList } from '@/hooks/useRubberBandList';
import type { Community } from '@/lib/communities';
import { ACCENT, MUTED_LIGHT } from '@/lib/colors';
import { searchByPrefix } from '@/lib/firestoreSearch';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as typeof FlatList;

export default function CommunitiesScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Community[]>([]);
  const [searching, setSearching] = useState(false);

  const { listRef, gesture, bounceStyle, onScroll, onContentSizeChange, onLayout } = useRubberBandList();

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

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    searchByPrefix('communities', 'nameLower', query, 15)
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
  }, [debouncedSearch, myCommunities]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Text className="text-3xl font-semibold text-zinc-900 dark:text-white">Communities</Text>
        <Link href="/communities/new" className="h-10 w-10 items-center justify-center">
          <Ionicons name="add" size={28} color={ACCENT} />
        </Link>
      </View>

      <View className="px-5 pb-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Find a community"
          placeholderTextColor={MUTED_LIGHT}
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-2xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
        />
      </View>

      {search.trim() ? (
        <>
          {searching ? <ActivityIndicator className="mt-2" /> : null}
          <GestureDetector gesture={gesture}>
            <Animated.View style={[{ flex: 1 }, bounceStyle]}>
              <AnimatedFlatList
                ref={listRef}
                data={searchResults}
                keyExtractor={(community) => community.id}
                contentContainerClassName="px-5"
                onScroll={onScroll}
                scrollEventThrottle={16}
                onContentSizeChange={onContentSizeChange}
                onLayout={onLayout}
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
            </Animated.View>
          </GestureDetector>
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
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ flex: 1 }, bounceStyle]}>
            <AnimatedFlatList
              ref={listRef}
              data={myCommunities}
              keyExtractor={(community) => community.id}
              contentContainerClassName="px-5"
              onScroll={onScroll}
              scrollEventThrottle={16}
              onContentSizeChange={onContentSizeChange}
              onLayout={onLayout}
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
          </Animated.View>
        </GestureDetector>
      )}
    </SafeAreaView>
  );
}
