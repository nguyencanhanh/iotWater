import { registerFcmTokenPost, unregisterFcmTokenDelete } from "../api";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = () => Object.values(firebaseConfig).every(Boolean)
  && Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY);

const FCM_SERVICE_WORKER_URL = "/firebase-messaging-sw.js?v=20260715-2";

export const showWebNotification = async (title, options = {}) => {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return;
    }
  }

  new Notification(title, options);
};

const loadFirebaseMessaging = async () => {
  const [{ initializeApp, getApps }, { getMessaging }] = await Promise.all([
    import(/* @vite-ignore */ "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js"),
    import(/* @vite-ignore */ "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js"),
  ]);
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  return { app, messaging };
};

export const registerWebPushNotifications = async () => {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      throw new Error("Trình duyệt này chưa hỗ trợ thông báo đẩy");
    }
    if (!hasFirebaseConfig()) {
      throw new Error("Frontend chưa có cấu hình Firebase Web Push");
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Bạn chưa cho phép nhận thông báo");
    }

    const [{ getToken }, { messaging }] = await Promise.all([
      import(/* @vite-ignore */ "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js"),
      loadFirebaseMessaging(),
    ]);

    const registration = await navigator.serviceWorker.register(FCM_SERVICE_WORKER_URL, {
      scope: "/",
      updateViaCache: "none",
    });
    await registration.update().catch(() => null);
    await navigator.serviceWorker.ready;
    const fcmToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!fcmToken) {
      throw new Error("Không lấy được FCM token");
    }

    await registerFcmTokenPost(localStorage.getItem("token"), fcmToken);
    localStorage.setItem("fcmToken", fcmToken);
    return fcmToken;
  } catch (error) {
    const code = error?.code ? `${error.code}: ` : "";
    throw new Error(`${code}${error?.message || "Không bật được thông báo"}`);
  }
};

export const unregisterWebPushNotifications = async () => {
  const savedToken = localStorage.getItem("fcmToken");
  if (!savedToken) {
    localStorage.removeItem("fcmRegistered");
    return true;
  }

  try {
    if (hasFirebaseConfig() && "serviceWorker" in navigator) {
      const [{ deleteToken }, { messaging }] = await Promise.all([
        import(/* @vite-ignore */ "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js"),
        loadFirebaseMessaging(),
      ]);
      await deleteToken(messaging).catch(() => null);
    }

    await unregisterFcmTokenDelete(localStorage.getItem("token"), savedToken);
    localStorage.removeItem("fcmToken");
    localStorage.removeItem("fcmRegistered");
    return true;
  } catch (error) {
    const code = error?.code ? `${error.code}: ` : "";
    throw new Error(`${code}${error?.message || "Không tắt được thông báo"}`);
  }
};

export const setupForegroundNotificationListener = async () => {
  if (!localStorage.getItem("fcmToken") || Notification.permission !== "granted") {
    return () => {};
  }

  const [{ onMessage }, { messaging }] = await Promise.all([
    import(/* @vite-ignore */ "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js"),
    loadFirebaseMessaging(),
  ]);

  return onMessage(messaging, (payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    showWebNotification(notification.title || "Cảnh báo IoT Water", {
      body: notification.body || data.message || "Có cảnh báo mới",
      icon: "/img/logo.jpeg",
      data,
    }).catch((error) => console.error("Không hiển thị được thông báo foreground:", error));
  });
};
