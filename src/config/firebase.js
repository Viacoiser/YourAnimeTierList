import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Reemplazar con tu configuración de Firebase
// Ve a https://console.firebase.google.com/ para obtener estas credenciales
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

// Check if Firebase is configured
const isConfigured = firebaseConfig.apiKey !== "TU_API_KEY";

let app, auth, db, googleProvider;

if (isConfigured) {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
} else {
    console.warn('⚠️ Firebase no está configurado. Por favor sigue las instrucciones en FIREBASE_SETUP.md');
}

export { auth, db, googleProvider };

// Auth functions
export const signInWithGoogle = async () => {
    if (!isConfigured) {
        throw new Error('Firebase no está configurado. Por favor configura tus credenciales en src/config/firebase.js');
    }

    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        console.error("Error signing in with Google:", error);
        throw error;
    }
};

export const logOut = async () => {
    if (!isConfigured) {
        throw new Error('Firebase no está configurado');
    }

    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out:", error);
        throw error;
    }
};
