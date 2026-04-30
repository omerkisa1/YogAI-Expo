import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'FIREBASE_API_KEY',
  authDomain: 'yogaai-ae871.firebaseapp.com',
  projectId: 'yogaai-ae871',
  storageBucket: 'yogaai-ae871.firebasestorage.app',
  messagingSenderId: 'FIREBASE_SENDER_ID',
  appId: 'FIREBASE_APP_ID',
};

const app = initializeApp(firebaseConfig);

// Metro resolves firebase/auth to the React Native bundle,
// which automatically uses AsyncStorage for persistence.
const auth = getAuth(app);

export { app, auth };
