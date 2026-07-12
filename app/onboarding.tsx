import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phone OTP entry — wired to Firebase Auth once credentials are available (M1).
export default function OnboardingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <View className="flex-1 items-center justify-center gap-3 px-10">
        <Text className="text-2xl font-semibold text-zinc-900 dark:text-white">Welcome to Echo</Text>
        <Text className="text-center text-base text-zinc-400 dark:text-zinc-500">
          Phone sign-in is coming online once auth is wired up.
        </Text>
      </View>
    </SafeAreaView>
  );
}
