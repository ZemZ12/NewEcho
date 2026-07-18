import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { StreamChat } from 'stream-chat';

import { useAuth } from '@/hooks/useAuth';

const STREAM_API_KEY = process.env.EXPO_PUBLIC_STREAM_API_KEY;

type StreamContextValue = {
  client: StreamChat | null;
};

const StreamContext = createContext<StreamContextValue>({ client: null });

// Connects to Stream Chat once a Firebase user is signed in, using a token
// minted server-side by the mintStreamToken Cloud Function (the Stream API
// secret can never live in the client). Disconnects on sign-out.
export function StreamChatProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [client, setClient] = useState<StreamChat | null>(null);

  useEffect(() => {
    if (!user) {
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
      await chatClient.connectUser({ id: user!.uid, name: user!.phoneNumber ?? user!.uid }, data.token);
      if (!cancelled) setClient(chatClient);
    }

    connect();

    return () => {
      cancelled = true;
      chatClient.disconnectUser();
      setClient(null);
    };
  }, [user]);

  return <StreamContext.Provider value={{ client }}>{children}</StreamContext.Provider>;
}

export function useStreamChat() {
  return useContext(StreamContext);
}
