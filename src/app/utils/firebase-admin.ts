import * as admin from 'firebase-admin';

// Initialize Firebase Admin (runs only once)
if (!admin.apps.length) {
  let credential;
  let credentialSource = 'none';
  
  console.log('[Firebase] Checking environment variables...');
  console.log('[Firebase] FIREBASE_SERVICE_ACCOUNT_KEY_B64:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64 ? 'SET' : 'NOT SET');
  console.log('[Firebase] FIREBASE_SERVICE_ACCOUNT_KEY:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'SET' : 'NOT SET');
  
  // Try base64-encoded service account (recommended for production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
    try {
      console.log('[Firebase] Attempting base64 decode...');
      const decoded = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64,
        'base64'
      ).toString('utf-8');
      
      const serviceAccountKey = JSON.parse(decoded);
      console.log('[Firebase] ✅ Base64 decoded successfully.project_id:', serviceAccountKey.project_id);
      
      if (!serviceAccountKey.project_id) {
        throw new Error('Decoded object missing project_id');
      }
      
      credential = admin.credential.cert(serviceAccountKey);
      credentialSource = 'FIREBASE_SERVICE_ACCOUNT_KEY_B64';
    } catch (err) {
      console.error('[Firebase] ❌ Base64 decode failed:', err);
      // Fall through to next option
    }
  }
  
  // Fallback to regular JSON (for local development)
  if (!credential && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      console.log('[Firebase] Attempting JSON parse of FIREBASE_SERVICE_ACCOUNT_KEY...');
      const serviceAccountKey = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      );
      console.log('[Firebase] ✅ JSON parsed successfully. project_id:', serviceAccountKey.project_id);
      
      if (!serviceAccountKey.project_id) {
        throw new Error('Parsed object missing project_id');
      }
      
      credential = admin.credential.cert(serviceAccountKey);
      credentialSource = 'FIREBASE_SERVICE_ACCOUNT_KEY';
    } catch (err) {
      console.error('[Firebase] ❌ JSON parse failed:', err);
      // Fall through to next option
    }
  }
  
  // Fallback to individual env variables
  if (!credential &&
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    try {
      console.log('[Firebase] Using individual env variables...');
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      });
      credentialSource = 'Individual env variables';
      console.log('[Firebase] ✅ Individual variables initialized');
    } catch (err) {
      console.error('[Firebase] ❌ Individual variables failed:', err);
    }
  }
  
  if (!credential) {
    const errorMsg = `Firebase credentials not configured. 
    - FIREBASE_SERVICE_ACCOUNT_KEY_B64: ${process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64 ? 'SET' : 'NOT SET'}
    - FIREBASE_SERVICE_ACCOUNT_KEY: ${process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'SET' : 'NOT SET'}
    - Individual vars: ${process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET'}`;
    console.error('[Firebase] ❌', errorMsg);
    throw new Error(errorMsg);
  }
  
  console.log('[Firebase] ✅ Using credential source:', credentialSource);
  
  admin.initializeApp({
    credential,
  });
  
  console.log('[Firebase] ✅ Admin SDK initialized successfully');
}

export default admin;