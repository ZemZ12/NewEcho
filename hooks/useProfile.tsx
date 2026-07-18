import firestore from '@react-native-firebase/firestore';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/hooks/useAuth';

export type Profile = {
  username: string;
  usernameLower: string;
  photoURL?: string;
};

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
};

const ProfileContext = createContext<ProfileContextValue>({ profile: null, loading: true });

// Tracks the signed-in user's public profile (currently just a username) in
// Firestore. `profile === null` after loading means the user hasn't picked
// a username yet, which the root layout uses to route into choose-username.
export function ProfileProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    return firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot((snapshot) => {
        setProfile(snapshot.exists() ? (snapshot.data() as Profile) : null);
        setLoading(false);
      });
  }, [user]);

  return <ProfileContext.Provider value={{ profile, loading }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export async function claimUsername(
  uid: string,
  rawUsername: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const username = rawUsername.trim();
  const usernameLower = username.toLowerCase();

  if (!USERNAME_PATTERN.test(usernameLower)) {
    return { ok: false, error: '3-20 characters: letters, numbers, underscores only.' };
  }

  const db = firestore();
  const usernameRef = db.collection('usernames').doc(usernameLower);
  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(usernameRef);
      if (existing.exists()) {
        throw new Error('taken');
      }
      tx.set(usernameRef, { uid });
      tx.set(userRef, { username, usernameLower, createdAt: firestore.FieldValue.serverTimestamp() });
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.message === 'taken') {
      return { ok: false, error: 'That username is already taken.' };
    }
    return { ok: false, error: 'Could not save that username. Try again.' };
  }
}

export async function updateAvatar(uid: string, photoURL: string): Promise<void> {
  await firestore().collection('users').doc(uid).update({ photoURL });
}
