import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { updateAvatar, useProfile } from '@/hooks/useProfile';
import { useStreamChat } from '@/hooks/useStreamChat';
import { pickImageFromCamera, pickImageFromLibrary } from '@/lib/pickImage';

export default function ProfileScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { client } = useStreamChat();
  const [uploading, setUploading] = useState(false);

  function handleChangePhoto() {
    Alert.alert('Change photo', undefined, [
      { text: 'Take photo', onPress: () => uploadFrom(pickImageFromCamera) },
      { text: 'Choose from library', onPress: () => uploadFrom(pickImageFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function uploadFrom(pick: () => Promise<{ uri: string; fileName: string | null } | null>) {
    if (!client || !user) return;
    const image = await pick();
    if (!image) return;

    setUploading(true);
    try {
      const result = await client.uploadImage(image.uri, image.fileName ?? undefined);
      await updateAvatar(user.uid, result.file);
    } catch (err) {
      Alert.alert('Could not update photo', err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['top']}>
      <View className="px-5 pb-2 pt-4">
        <Text className="text-3xl font-semibold text-zinc-900 dark:text-white">Profile</Text>
      </View>

      <View className="flex-1 items-center justify-center gap-1 px-10">
        <Pressable onPress={handleChangePhoto} disabled={uploading} className="mb-3">
          <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            {uploading ? (
              <ActivityIndicator />
            ) : profile?.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={{ width: 96, height: 96 }} />
            ) : (
              <Text className="text-3xl font-semibold text-zinc-400 dark:text-zinc-500">
                {profile?.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            )}
          </View>
          <Text className="mt-1 text-center text-sm font-medium text-accent">Change photo</Text>
        </Pressable>

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
