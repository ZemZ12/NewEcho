import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getMessaging, getToken, onTokenRefresh, requestPermission } from '@react-native-firebase/messaging';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { StreamChat } from 'stream-chat';

import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

// Must match the "Name" given to the Firebase push configuration in Stream's
// dashboard (Chat Messaging > Push Notifications) — addDevice's push_provider
// argument alone ('firebase') isn't enough to identify which configuration
// to use, so calls without this name were silently failing to register.
const PUSH_PROVIDER_NAME = 'firebaseNotification';

// Requests notification permission, registers the device's FCM token with
// Stream (so Stream can push through Firebase when this device isn't
// actively watching a channel), and keeps it current on token refresh.
// Failures here shouldn't block chat from working, so they're swallowed.
async function registerPushDevice(chatClient: StreamChat) {
  try {
    const messaging = getMessaging(getApp());
    await requestPermission(messaging);
    const token = await getToken(messaging);
    await chatClient.addDevice(token, 'firebase', undefined, PUSH_PROVIDER_NAME);
  } catch (err) {
    console.warn('Could not register push device:', err);
  }
}

const STREAM_API_KEY = process.env.EXPO_PUBLIC_STREAM_API_KEY;
const RETRY_DELAY_MS = 3000;

type StreamContextValue = {
  client: StreamChat | null;
  error: boolean;
};

const StreamContext = createContext<StreamContextValue>({ client: null, error: false });

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
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user || !profile) {
      setClient(null);
      setError(false);
      return;
    }

    if (!STREAM_API_KEY) {
      console.warn('EXPO_PUBLIC_STREAM_API_KEY is not set; chat will not connect.');
      return;
    }

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    const chatClient = StreamChat.getInstance(STREAM_API_KEY);

    let unsubscribeTokenRefresh: (() => void) | undefined;

    // getInstance() is a singleton keyed by API key, so switching accounts
    // (e.g. signing out and into a different user) reuses the same
    // underlying client — make sure any previous session is fully torn down
    // before connecting the new one, rather than letting connectUser() race
    // an in-flight disconnectUser() from the prior effect's cleanup.
    async function connect() {
      try {
        if (chatClient.user && chatClient.user.id !== user!.uid) {
          await chatClient.disconnectUser();
        }
        if (cancelled) return;

        const mintStreamToken = httpsCallable<void, { token: string }>(getFunctions(getApp()), 'mintStreamToken');
        const { data } = await mintStreamToken();
        if (cancelled) return;
        await chatClient.connectUser({ id: user!.uid, name: profile!.username, image: profile!.photoURL }, data.token);
        if (cancelled) return;

        setClient(chatClient);
        setError(false);

        registerPushDevice(chatClient);
        unsubscribeTokenRefresh = onTokenRefresh(getMessaging(getApp()), (token) => {
          chatClient
            .addDevice(token, 'firebase', undefined, PUSH_PROVIDER_NAME)
            .catch((err) => console.warn('Could not update push device:', err));
        });
      } catch (err) {
        if (cancelled) return;
        console.warn('Could not connect to Stream Chat, retrying:', err);
        setError(true);
        retryTimeout = setTimeout(connect, RETRY_DELAY_MS);
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      unsubscribeTokenRefresh?.();
      chatClient.disconnectUser();
      setClient(null);
    };
    // Deliberately keyed on the username (stable/immutable once set), not the
    // whole profile object — avatar changes update the already-connected
    // user in place below instead of tearing down and reconnecting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.username]);

  useEffect(() => {
    if (!client || !client.userID || !profile?.photoURL) return;
    client
      .partialUpdateUser({ id: client.userID, set: { image: profile.photoURL } })
      .catch((err) => console.warn('Could not update Stream avatar:', err));
  }, [client, profile?.photoURL]);

  return <StreamContext.Provider value={{ client, error }}>{children}</StreamContext.Provider>;
}

export function useStreamChat() {
  return useContext(StreamContext);
}
