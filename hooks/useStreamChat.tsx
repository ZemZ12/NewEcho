import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getMessaging, getToken, onTokenRefresh, requestPermission } from '@react-native-firebase/messaging';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { StreamChat } from 'stream-chat';

import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

// Requests notification permission, registers the device's FCM token with
// Stream (so Stream can push through Firebase when this device isn't
// actively watching a channel), and keeps it current on token refresh.
// Failures here shouldn't block chat from working, so they're swallowed.
async function registerPushDevice(chatClient: StreamChat) {
  try {
    const messaging = getMessaging(getApp());
    await requestPermission(messaging);
    const token = await getToken(messaging);
    await chatClient.addDevice(token, 'firebase');
  } catch (err) {
    console.warn('Could not register push device:', err);
  }
}

const STREAM_API_KEY = process.env.EXPO_PUBLIC_STREAM_API_KEY;

type StreamContextValue = {
  client: StreamChat | null;
};

const StreamContext = createContext<StreamContextValue>({ client: null });

// Connects to Stream Chat once a Firebase user is signed in AND has claimed
// a username, using a token minted server-side by the mintStreamToken Cloud
// Function (the Stream API secret can never live in the client). The Stream
// user's display name is the username, never the phone number — other
// members of a channel can see it, and phone numbers must stay private.
// Disconnects on sign-out.
export function StreamChatProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [client, setClient] = useState<StreamChat | null>(null);

  useEffect(() => {
    if (!user || !profile) {
      setClient(null);
      return;
    }

    if (!STREAM_API_KEY) {
      console.warn('EXPO_PUBLIC_STREAM_API_KEY is not set; chat will not connect.');
      return;
    }

    let cancelled = false;
    const chatClient = StreamChat.getInstance(STREAM_API_KEY);

    let unsubscribeTokenRefresh: (() => void) | undefined;

    async function connect() {
      const mintStreamToken = httpsCallable<void, { token: string }>(getFunctions(getApp()), 'mintStreamToken');
      const { data } = await mintStreamToken();
      if (cancelled) return;
      await chatClient.connectUser({ id: user!.uid, name: profile!.username }, data.token);
      if (cancelled) return;
      setClient(chatClient);

      registerPushDevice(chatClient);
      unsubscribeTokenRefresh = onTokenRefresh(getMessaging(getApp()), (token) => {
        chatClient.addDevice(token, 'firebase').catch((err) => console.warn('Could not update push device:', err));
      });
    }

    connect();

    return () => {
      cancelled = true;
      unsubscribeTokenRefresh?.();
      chatClient.disconnectUser();
      setClient(null);
    };
  }, [user, profile]);

  return <StreamContext.Provider value={{ client }}>{children}</StreamContext.Provider>;
}

export function useStreamChat() {
  return useContext(StreamContext);
}
