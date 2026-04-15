import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCxisG9BJJJxePqiHkR705GqtQ5jVB0DiE",
  authDomain: "vicmarhomesweb.firebaseapp.com",
  databaseURL: "https://vicmarhomesweb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vicmarhomesweb",
  storageBucket: "vicmarhomesweb.firebasestorage.app",
  messagingSenderId: "224644292114",
  appId: "1:224644292114:web:16d37eb73dc2ca6a3d82cb",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };