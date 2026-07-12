import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Chat list — will be wired to Stream Chat's channel list in M1.
// Empty state shown until real conversations exist.
export default function ChatListScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Text className="text-3xl font-semibold text-zinc-900 dark:text-white">Chats</Text>
        <Link href="/new-group" className="rounded-full bg-accent px-4 py-2">
          <Text className="font-medium text-white">New</Text>
        </Link>
      </View>

      <View className="flex-1 items-center justify-center gap-2 px-10">
        <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">
          No conversations yet. Start a chat with your friends to see it here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
