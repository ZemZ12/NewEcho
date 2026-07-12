import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// New group modal — friend picker (by phone number) lands once auth (M1) is wired.
export default function NewGroupScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <Stack.Screen options={{ title: 'New Group', presentation: 'modal' }} />
      <View className="flex-1 items-center justify-center px-10">
        <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">
          Sign in to start a group with your friends.
        </Text>
      </View>
    </SafeAreaView>
  );
}
