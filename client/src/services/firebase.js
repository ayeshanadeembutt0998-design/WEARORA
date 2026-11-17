import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const firebaseConfigured = Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
let auth;

/** Opens the Google popup and returns a Firebase ID token for the Wearora backend to verify. */
export async function getGoogleIdToken() {
  if (!firebaseConfigured) throw new Error('Google sign-in is not configured yet.');
  if (!auth) auth = getAuth(initializeApp(cfg));
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const token = await cred.user.getIdToken();
  await signOut(auth).catch(() => {}); // Wearora manages its own session
  return token;
}
