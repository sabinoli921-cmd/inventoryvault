import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from "firebase/auth";
import { 
  getFirestore, 
  collection as firestoreCollection, 
  doc as firestoreDoc, 
  getDoc as firestoreGetDoc, 
  getDocs as firestoreGetDocs, 
  setDoc as firestoreSetDoc, 
  addDoc as firestoreAddDoc, 
  updateDoc as firestoreUpdateDoc, 
  deleteDoc as firestoreDeleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot as firestoreOnSnapshot,
  getDocFromServer,
  Timestamp,
  writeBatch
} from "firebase/firestore";

// Import the config dynamically or define standard fallback
import firebaseConfigData from "../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId || undefined);

// Local Database Simulation State
let localSessionActive = false;

function setLocalSessionActive(active: boolean) {
  localSessionActive = active;
  if (active) {
    console.log("Local Sandbox Database Session activated.");
    // Initialize default collections if empty to provide rich initial data
    initializeLocalDataIfEmpty();
  }
}

function isLocalSession() {
  return localSessionActive;
}

const getLocalCollection = (colName: string): Record<string, any> => {
  const data = localStorage.getItem(`local_db_${colName}`);
  return data ? JSON.parse(data) : {};
};

const saveLocalCollection = (colName: string, colData: Record<string, any>) => {
  localStorage.setItem(`local_db_${colName}`, JSON.stringify(colData));
  window.dispatchEvent(new CustomEvent("local-db-update", { detail: { collection: colName } }));
};

function initializeLocalDataIfEmpty() {
  const collectionsToInit = ["categories", "items", "transactions", "productions", "roles", "userProfiles", "auditLogs", "settings"];
  collectionsToInit.forEach(col => {
    const existing = localStorage.getItem(`local_db_${col}`);
    if (!existing) {
      localStorage.setItem(`local_db_${col}`, JSON.stringify({}));
    }
  });
}

// Proxied Firestore functions
function collection(dbInstance: any, path: string, ...pathSegments: string[]) {
  const ref = firestoreCollection(dbInstance, path, ...pathSegments);
  return ref;
}

function doc(dbInstance: any, path: string, ...pathSegments: string[]) {
  const ref = firestoreDoc(dbInstance, path, ...pathSegments);
  return ref;
}

const buildMockSnapshot = (colName: string) => {
  const colData = getLocalCollection(colName);
  const docs = Object.entries(colData).map(([id, data]) => ({
    id,
    data: () => data,
    exists: () => true
  }));
  return {
    forEach: (callback: (doc: any) => void) => {
      docs.forEach(callback);
    },
    docs,
    empty: docs.length === 0,
    size: docs.length
  };
};

async function getDoc(docRef: any) {
  if (localSessionActive) {
    const parts = docRef.path.split("/");
    const colName = parts[0];
    const id = parts[1] || docRef.id;
    const colData = getLocalCollection(colName);
    const data = colData[id];
    return {
      exists: () => !!data,
      data: () => data,
      id
    };
  }
  return firestoreGetDoc(docRef);
}

async function getDocs(queryRef: any) {
  if (localSessionActive) {
    const colName = queryRef.path ? queryRef.path.split("/")[0] : "unknown";
    return buildMockSnapshot(colName);
  }
  return firestoreGetDocs(queryRef);
}

function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  if (typeof obj === "object" && obj.constructor === Object) {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = cleanUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

async function setDoc(docRef: any, data: any, options?: any) {
  const cleanedData = cleanUndefined(data);
  if (localSessionActive) {
    const parts = docRef.path.split("/");
    const colName = parts[0];
    const id = parts[1] || docRef.id;
    const colData = getLocalCollection(colName);
    
    if (options?.merge && colData[id]) {
      colData[id] = { ...colData[id], ...cleanedData };
    } else {
      colData[id] = cleanedData;
    }
    
    saveLocalCollection(colName, colData);
    return;
  }
  return firestoreSetDoc(docRef, cleanedData, options);
}

async function addDoc(colRef: any, data: any) {
  const cleanedData = cleanUndefined(data);
  if (localSessionActive) {
    const colName = colRef.path;
    const id = "local_id_" + Math.floor(100000 + Math.random() * 900000);
    const colData = getLocalCollection(colName);
    
    // Inject auto-id
    const record = { id, ...cleanedData };
    colData[id] = record;
    
    saveLocalCollection(colName, colData);
    return { id };
  }
  return firestoreAddDoc(colRef, cleanedData);
}

async function updateDoc(docRef: any, data: any) {
  const cleanedData = cleanUndefined(data);
  if (localSessionActive) {
    const parts = docRef.path.split("/");
    const colName = parts[0];
    const id = parts[1] || docRef.id;
    const colData = getLocalCollection(colName);
    
    if (colData[id]) {
      colData[id] = { ...colData[id], ...cleanedData };
      saveLocalCollection(colName, colData);
    }
    return;
  }
  return firestoreUpdateDoc(docRef, cleanedData);
}

async function deleteDoc(docRef: any) {
  if (localSessionActive) {
    const parts = docRef.path.split("/");
    const colName = parts[0];
    const id = parts[1] || docRef.id;
    const colData = getLocalCollection(colName);
    
    if (colData[id]) {
      delete colData[id];
      saveLocalCollection(colName, colData);
    }
    return;
  }
  return firestoreDeleteDoc(docRef);
}

function onSnapshot(queryRef: any, onNext: any, onError?: any) {
  if (localSessionActive) {
    const colName = queryRef.path ? queryRef.path.split("/")[0] : "unknown";
    
    // Call initial query snapshot immediately in the microtask
    setTimeout(() => {
      onNext(buildMockSnapshot(colName));
    }, 0);
    
    // Subscribe to updates via CustomEvent
    const listener = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.collection === colName) {
        onNext(buildMockSnapshot(colName));
      }
    };
    window.addEventListener("local-db-update", listener);
    return () => {
      window.removeEventListener("local-db-update", listener);
    };
  }
  return firestoreOnSnapshot(queryRef, onNext, onError);
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Test Connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or network status.");
    } else {
      console.log("Firebase initialized successfully.");
    }
  }
}
testConnection();

export {
  app,
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  writeBatch,
  setLocalSessionActive,
  isLocalSession
};
