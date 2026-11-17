import admin from 'firebase-admin';
import { env } from './env.js';

let app = null;

export function isFirebaseConfigured() {
  const f = env.firebase;
  return Boolean(f.projectId && f.clientEmail && f.privateKey);
}

export function getFirebaseAuth() {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebase.projectId,
        clientEmail: env.firebase.clientEmail,
        privateKey: env.firebase.privateKey,
      }),
    });
  }
  return admin.auth(app);
}
