import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

export default function ProfileScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['top']}>
      <View className="px-5 pb-2 pt-4">
        <Text className="text-3xl font-semibold text-zinc-900 dark:text-white">Profile</Text>
      </View>

      <View className="flex-1 items-center justify-center gap-1 px-10">
        <Text className="text-center text-xl font-medium text-zinc-900 dark:text-white">
          {profile?.username ?? 'Signed in'}
        </Text>
        <Text className="mb-3 text-center text-base text-zinc-400 dark:text-zinc-500">{user?.phoneNumber}</Text>
        <Pressable
          onPress={() => signOut(getAuth(getApp()))}
          className="items-center rounded-full bg-accent px-4 py-3">
          <Text className="font-medium text-white">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
