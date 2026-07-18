import { initializeApp } from 'firebase-admin/app';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { StreamChat } from 'stream-chat';

initializeApp();

const streamApiKey = defineSecret('STREAM_API_KEY');
const streamApiSecret = defineSecret('STREAM_API_SECRET');

// Mints a Stream Chat user token for the signed-in Firebase user. The Stream
// API secret can never live in the client bundle, so token creation has to
// happen here rather than in the app.
export const mintStreamToken = onCall({ secrets: [streamApiKey, streamApiSecret] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before requesting a chat token.');
  }

  const client = StreamChat.getInstance(streamApiKey.value(), streamApiSecret.value());
  const token = client.createToken(request.auth.uid);

  return { token };
});
