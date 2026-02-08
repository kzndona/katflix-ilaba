import * as admin from 'firebase-admin';

// Initialize Firebase Admin (runs only once)
if (!admin.apps.length) {
  const serviceAccountKey = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );
  
  // Fix escaped newlines in private_key for PEM format
  if (serviceAccountKey.private_key) {
    serviceAccountKey.private_key = serviceAccountKey.private_key.replace(
      /\\n/g,
      '\n'
    );
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
  });
}

export default admin;