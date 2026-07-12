import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Profile / settings — wired to the signed-in user's profile once auth (M1) lands.
export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['top']}>
      <View className="px-5 pb-2 pt-4">
        <Text className="text-3xl font-semibold text-zinc-900 dark:text-white">Profile</Text>
      </View>

      <View className="flex-1 items-center justify-center px-10">
        <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">
          Sign in to set up your profile.
        </Text>
      </View>
    </SafeAreaView>
  );
}
