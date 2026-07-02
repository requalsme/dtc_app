import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIza" + "SyBLAj8h8i4JLGjw0Ms5CE9aabpoM2G57ng",
  authDomain: "dtcapp-24504.firebaseapp.com",
  projectId: "dtcapp-24504",
  storageBucket: "dtcapp-24504.firebasestorage.app",
  messagingSenderId: "373168542820",
  appId: "1:373168542820:web:69750756b1712976febb71",
  measurementId: "G-TTJ9KN3KT2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
