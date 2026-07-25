self.IOT_WATER_SW_VERSION = "20260715-2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const getNotificationPayload = (payload = {}) => {
  const notification = payload.notification || payload.webpush?.notification || {};
  const data = payload.data || {};
  return {
    title: notification.title || data.title || "Cảnh báo IoT Water",
    options: {
      body: notification.body || data.message || data.body || "Có cảnh báo mới",
      icon: notification.icon || data.icon || "/img/logo.jpeg",
      badge: notification.badge || data.badge || "/img/logo.jpeg",
      tag: notification.tag || data.tag || `iot-water-${Date.now()}`,
      requireInteraction: true,
      data: {
        ...data,
        link: data.link || payload.fcmOptions?.link || payload.fcm_options?.link || "/",
      },
    },
  };
};

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { data: { message: event.data?.text?.() || "Có cảnh báo mới" } };
  }

  const { title, options } = getNotificationPayload(payload);
  event.stopImmediatePropagation();
  event.waitUntil(self.registration.showNotification(title, options));
});

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD0J0_hrAxGmE7vDirZAxMf_XaEOAFz14I",
  authDomain: "canhanh12-d05ad.firebaseapp.com",
  projectId: "canhanh12-d05ad",
  storageBucket: "canhanh12-d05ad.firebasestorage.app",
  messagingSenderId: "1078128423226",
  appId: "1:1078128423226:web:1ca227ebb28db9a10f6003",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, options } = getNotificationPayload(payload);
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(self.clients.openWindow(link));
});
