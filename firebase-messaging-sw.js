importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAIpjNh7FPnFJBTOj4RP9lVGIRba4EIbQg',
  authDomain: 'petoclub-ea0d1.firebaseapp.com',
  projectId: 'petoclub-ea0d1',
  storageBucket: 'petoclub-ea0d1.firebasestorage.app',
  messagingSenderId: '63121240864',
  appId: '1:63121240864:web:37cf4ccdde5a6c3e9b1d45',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Recibido en background:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
