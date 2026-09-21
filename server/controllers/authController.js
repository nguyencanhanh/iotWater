import User from '../models/User.js';
import Info from '../models/Info.js';
import FcmToken from '../models/FcmToken.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'
import { clientRedis } from "../mqtt/redis.js";
import axios from 'axios';
import { createSign } from 'crypto';

const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL || "https://khca-s.static.good-dns.net/";

const toBase64Url = (value) => Buffer
  .from(value)
  .toString("base64")
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");

const normalizePrivateKey = (key) => key?.replace(/\\n/g, "\n");

const getFcmAccessToken = async () => {
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FCM_PRIVATE_KEY);
  if (!process.env.FCM_PROJECT_ID || !clientEmail || !privateKey) {
    throw new Error("FCM env is missing");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsignedJwt = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256")
    .update(unsignedJwt)
    .sign(privateKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const res = await axios.post("https://oauth2.googleapis.com/token", new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${unsignedJwt}.${signature}`,
  }));
  return res.data.access_token;
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" })
    }
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid Password" })
    }
    const token = jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "10d" })

    return res.status(200).json({ success: true, token, user: { _id: user._id, name: user.name, role: user.role } })
  } catch (error) {
    console.log('login error', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}

export const verify = (req, res) => {
  return res.status(200).json({ success: true, user: req.user })
}

export const info = async (req, res) => {
  try {
    const info = await Info.find().lean()

    const keys = info.map(sensor => `warning:${sensor.id}`)
    const values = await clientRedis.mGet(keys)

    info.forEach((sensor, i) => {
      sensor.warning = values[i] // null | "warning"
    })

    return res.json({ success: true, info })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
}

export const registerFcmToken = async (req, res) => {
  try {
    const { token, platform = "web" } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: "FCM token is required" });
    }

    await FcmToken.findOneAndUpdate(
      { token },
      {
        $set: {
          userId: req.user._id,
          userNumber: req.user.user ?? 0,
          token,
          platform,
          userAgent: req.headers["user-agent"] || "",
          active: true,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export const unregisterFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: "FCM token is required" });
    }

    await FcmToken.findOneAndUpdate(
      { token, userId: req.user._id },
      {
        $set: {
          active: false,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export const sendFcmTest = async (req, res) => {
  try {
    const requestedToken = req.body?.token;
    const userTokenQuery = {
      active: true,
      $or: [
        { userId: req.user._id },
        { userNumber: req.user.user ?? 0 },
      ],
    };
    console.log(`FCM test request: hasToken=${Boolean(requestedToken)}, user=${req.user?._id}`);
    let tokenDoc = requestedToken
      ? await FcmToken.findOne({ token: requestedToken, $or: userTokenQuery.$or })
      : await FcmToken.findOne(userTokenQuery).sort({ updatedAt: -1 });

    if (tokenDoc && !tokenDoc.active) {
      tokenDoc.active = true;
      tokenDoc.updatedAt = new Date();
      await tokenDoc.save();
    }

    if (!tokenDoc) {
      tokenDoc = await FcmToken.findOne(userTokenQuery).sort({ updatedAt: -1 });
    }

    if (!tokenDoc) {
      console.log("FCM test lỗi: không có token active");
      return res.status(404).json({ success: false, error: "Không có thiết bị FCM đang bật" });
    }

    const message = `Test thông báo IoT Water ${new Date().toLocaleTimeString("vi-VN")}`;
    const isExpoToken = tokenDoc.platform === "expo" ||
      String(tokenDoc.token).startsWith("ExpoPushToken") ||
      String(tokenDoc.token).startsWith("ExponentPushToken");

    if (isExpoToken) {
      const result = await axios.post(
        "https://exp.host/--/api/v2/push/send",
        {
          to: tokenDoc.token,
          title: "Test IoT Water",
          body: message,
          data: {
            type: "test",
            message,
          },
          sound: "default",
          priority: "high",
          channelId: "water-alerts",
        },
        {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`Expo push test gửi thành công tới token ${tokenDoc.token.slice(0, 18)}.`);
      return res.status(200).json({ success: true, name: result.data?.data?.id || "expo-push" });
    }

    const accessToken = await getFcmAccessToken();
    const result = await axios.post(
      `https://fcm.googleapis.com/v1/projects/${process.env.FCM_PROJECT_ID}/messages:send`,
      {
        message: {
          token: tokenDoc.token,
          notification: {
            title: "Test IoT Water",
            body: message,
          },
          android: {
            priority: "HIGH",
            notification: {
              channel_id: "water-alerts",
              sound: "default",
              priority: "HIGH",
            },
          },
          webpush: {
            headers: {
              Urgency: "high",
            },
            fcm_options: {
              link: PUBLIC_WEB_URL,
            },
          },
          data: {
            type: "test",
            title: "Test IoT Water",
            message,
            body: message,
            icon: "/img/logo.jpeg",
            badge: "/img/logo.jpeg",
            tag: `iot-water-test-${Date.now()}`,
            link: PUBLIC_WEB_URL,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`FCM test gửi thành công tới token ${tokenDoc.token.slice(0, 18)}: ${result.data.name}`);
    return res.status(200).json({ success: true, name: result.data.name });
  } catch (error) {
    console.error("FCM test lỗi:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
}
