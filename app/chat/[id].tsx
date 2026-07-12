import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Chat screen — custom message list, bubbles, and animations land in M1/M2
// once this is wired to a Stream Chat channel via useLocalSearchParams().id.
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['bottom']}>
      <Stack.Screen options={{ title: id ?? 'Chat' }} />
      <View className="flex-1 items-center justify-center px-10">
        <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">
          This conversation will appear here once chat is connected.
        </Text>
      </View>
    </SafeAreaView>
  );
}
