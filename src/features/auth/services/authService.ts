import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '@/shared/config/firebase';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID_IOS = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_ANDROID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_WEB = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

export const authService = {
  signInWithGoogle: async () => {
    const clientId = Platform.select({
      ios: GOOGLE_CLIENT_ID_IOS,
      android: GOOGLE_CLIENT_ID_ANDROID,
      default: GOOGLE_CLIENT_ID_WEB,
    });

    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'yogai' });

    const request = new AuthSession.AuthRequest({
      clientId: clientId!,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
    });

    const result = await request.promptAsync({
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    });

    if (result.type === 'success' && result.params.id_token) {
      const credential = GoogleAuthProvider.credential(result.params.id_token);
      const userCredential = await signInWithCredential(auth, credential);
      return { userCredential, provider: 'google' as const };
    }

    throw new Error('Google Sign-In cancelled or failed');
  },

  registerWithEmail: async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName });
    return { userCredential, provider: 'email' as const };
  },

  signInWithEmail: async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { userCredential, provider: 'email' as const };
  },

  resetPassword: async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  },

  signOut: async () => {
    return firebaseSignOut(auth);
  },

  getCurrentUser: () => auth.currentUser,

  getIdToken: async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken(true);
  },

  onAuthStateChanged: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  getPlatform: (): string => Platform.OS,

  getAuthProvider: (): string => {
    const user = auth.currentUser;
    if (!user) return 'unknown';
    const providers = user.providerData;
    if (providers.some(p => p.providerId === 'google.com')) return 'google';
    if (providers.some(p => p.providerId === 'password')) return 'email';
    return 'unknown';
  },
};
