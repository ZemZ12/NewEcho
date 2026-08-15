import firestore from '@react-native-firebase/firestore';

export type Community = {
  id: string;
  name: string;
  nameLower: string;
  description: string;
  ownerId: string;
  memberIds: string[];
};

export async function createCommunity(uid: string, name: string, description: string): Promise<string> {
  const trimmedName = name.trim();
  const doc = await firestore()
    .collection('communities')
    .add({
      name: trimmedName,
      nameLower: trimmedName.toLowerCase(),
      description: description.trim(),
      ownerId: uid,
      memberIds: [uid],
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  return doc.id;
}

export async function joinCommunityDoc(communityId: string, uid: string): Promise<void> {
  await firestore()
    .collection('communities')
    .doc(communityId)
    .update({ memberIds: firestore.FieldValue.arrayUnion(uid) });
}

export async function leaveCommunityDoc(communityId: string, uid: string): Promise<void> {
  await firestore()
    .collection('communities')
    .doc(communityId)
    .update({ memberIds: firestore.FieldValue.arrayRemove(uid) });
}
