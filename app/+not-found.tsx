import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center gap-3 bg-white px-6 dark:bg-surface-dark">
        <Text className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          This screen doesn't exist.
        </Text>
        <Link href="/" className="py-4">
          <Text className="text-accent">Go to Chats</Text>
        </Link>
      </View>
    </>
  );
}
