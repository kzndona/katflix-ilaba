import * as admin from 'firebase-admin';

// Initialize Firebase Admin (runs only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')
    ),
  });
}

export default admin;