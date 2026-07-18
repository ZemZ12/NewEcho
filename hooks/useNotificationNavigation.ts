import { getApp } from '@react-native-firebase/app';
import { getInitialNotification, getMessaging, onNotificationOpenedApp } from '@react-native-firebase/messaging';
import { router } from 'expo-router';
import { useEffect } from 'react';

// Stream's push payload includes the channel's cid ("messaging:abc123") in
// the data object. Falls back to a bare channel_id key in case the payload
// shape differs from what's documented.
function channelIdFromData(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const cid = data.cid;
  if (typeof cid === 'string' && cid.includes(':')) {
    return cid.split(':')[1];
  }
  if (typeof data.channel_id === 'string') {
    return data.channel_id;
  }
  return null;
}

// Navigates to the relevant chat when a push notification is tapped, both
// from a background app state and from a fully killed one.
export function useNotificationNavigation() {
  useEffect(() => {
    const messaging = getMessaging(getApp());

    getInitialNotification(messaging).then((remoteMessage) => {
      const channelId = channelIdFromData(remoteMessage?.data);
      if (channelId) router.push(`/chat/${channelId}`);
    });

    return onNotificationOpenedApp(messaging, (remoteMessage) => {
      const channelId = channelIdFromData(remoteMessage.data);
      if (channelId) router.push(`/chat/${channelId}`);
    });
  }, []);
}
