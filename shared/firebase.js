// firebase.js — inicialización compartida
// Importar en cada módulo con:
//   import { db } from '../shared/firebase.js';  (desde módulos)
//   import { db } from './shared/firebase.js';   (desde raíz)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getAuth }      from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBirDdLyr-a6kjkcMxvRDuCJ3SW0WTDsPk",
  authDomain:        "appjw-3697e.firebaseapp.com",
  projectId:         "appjw-3697e",
  storageBucket:     "appjw-3697e.firebasestorage.app",
  messagingSenderId: "161788232097",
  appId:             "1:161788232097:web:c17614effa82dceef90be0",
};

const app = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);