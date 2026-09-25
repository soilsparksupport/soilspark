import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

const firebaseConfig={apiKey:"AIzaSyCJ8Zg6qRYa2QrMbKjG4I1B3Dxg1_Z51EI",authDomain:"soilspark.firebaseapp.com",projectId:"soilspark",storageBucket:"soilspark.firebasestorage.app",messagingSenderId:"22641848933",appId:"1:22641848933:web:4c08ce5046681dbb698c8c",measurementId:"G-1M406BN9JK"};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}