import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from 'expo-image-picker';

export type PickedImage = { uri: string; fileName: string | null; mimeType: string | null };

async function fromResult(
  result: Awaited<ReturnType<typeof launchImageLibraryAsync>>,
): Promise<PickedImage | null> {
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, fileName: asset.fileName ?? null, mimeType: asset.mimeType ?? null };
}

export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  const permission = await requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  return fromResult(result);
}

export async function pickImageFromCamera(): Promise<PickedImage | null> {
  const permission = await requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  return fromResult(result);
}
