import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { StreamChat } from 'stream-chat';

import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

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

    async function connect() {
      const mintStreamToken = httpsCallable<void, { token: string }>(getFunctions(getApp()), 'mintStreamToken');
      const { data } = await mintStreamToken();
      if (cancelled) return;
      await chatClient.connectUser({ id: user!.uid, name: profile!.username }, data.token);
      if (!cancelled) setClient(chatClient);
    }

    connect();

    return () => {
      cancelled = true;
      chatClient.disconnectUser();
      setClient(null);
    };
  }, [user, profile]);

  return <StreamContext.Provider value={{ client }}>{children}</StreamContext.Provider>;
}

export function useStreamChat() {
  return useContext(StreamContext);
}
