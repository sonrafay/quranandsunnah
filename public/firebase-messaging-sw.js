/* public/firebase-messaging-sw.js */
/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// Hard-code your web app config here to avoid env issues in the SW.
// Make sure these match src/lib/firebase.ts (NEXT_PUBLIC_... values).
firebase.initializeApp({
  apiKey: "YOUR_WEB_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
});

const messaging = firebase.messaging();

// Background/terminated messages arrive here
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "Quran & Sunnah";
  const body  = payload?.notification?.body  || "You have a new message";
  const icon  = "/icons/icon-192.png"; // optional: put one in public/icons

  self.registration.showNotification(title, {
    body,
    icon,
    data: payload?.data || {},
  });
});
