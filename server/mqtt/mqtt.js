import mqtt from "mqtt"
import Sensor from "../models/Sensor.js"
import Info from "../models/Info.js";
import Prv from "../models/PrvData.js";
import PrvInfo from "../models/Prv.js";
import PrvControl from "../models/PrvControl.js"
import Alarm from "../models/AlarmFlow.js";
import FcmToken from "../models/FcmToken.js";
import cron from 'node-cron'
import axios from 'axios';
// import { fetchTimeAlarm } from "../controllers/sensorController.js"
import { createSign } from 'crypto';
import { clientRedis } from "./redis.js";

const allUser = [0]
const allSensors = []
const allPrv = []
const countLost = []
const host = 'khca-s.static.good-dns.net';
const port = 1883;
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`

const connectUrl = `mqtt://${host}:${port}`

const topic = 'iotwatter@2024'
const topicPrv = 'logger/pressure'
const topicPrvSend = 'prv/send'
const topic_config = "logger/get_config"
const topicConfigAck = "logger/config"
export let client = null
const LOGGER_CONFIG_TTL_SECONDS = 24 * 60 * 60;
const getLoggerConfigPendingKey = (requestId) => `loggerConfig:pending:${requestId}`;
const getLoggerConfigActiveKey = (user, sensorId) => `loggerConfig:active:${Number(user) || 0}:${Number(sensorId)}`;
const getLoggerConfigAckKey = (user, sensorId) => `loggerConfig:ack:${Number(user) || 0}:${Number(sensorId)}`;

const parseLoggerConfigActiveRequestIds = (rawValue) => {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch (error) {
    // Backward compatible with the previous single-request string value.
  }
  return [String(rawValue)].filter(Boolean);
};

const saveLoggerConfigActiveRequestIds = async (user, sensorId, requestIds) => {
  const activeKey = getLoggerConfigActiveKey(user, sensorId);
  const uniqueRequestIds = [...new Set(requestIds.map(String).filter(Boolean))];
  if (uniqueRequestIds.length === 0) {
    await clientRedis.del(activeKey);
    return;
  }

  await clientRedis.set(
    activeKey,
    JSON.stringify(uniqueRequestIds),
    { EX: LOGGER_CONFIG_TTL_SECONDS }
  );
};

const removeLoggerConfigActiveRequests = async (user, sensorId, acknowledgedRequestIds) => {
  const activeKey = getLoggerConfigActiveKey(user, sensorId);
  const currentRequestIds = parseLoggerConfigActiveRequestIds(await clientRedis.get(activeKey));
  const acknowledgedSet = new Set(acknowledgedRequestIds.map(String));
  await saveLoggerConfigActiveRequestIds(
    user,
    sensorId,
    currentRequestIds.filter((requestId) => !acknowledgedSet.has(requestId))
  );
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function markLoggerConfigAck({ user, sensorId, payload }) {
  const numericUser = Number(user) || 0;
  const numericSensorId = Number(sensorId);
  const activeKey = getLoggerConfigActiveKey(numericUser, numericSensorId);
  const requestIds = parseLoggerConfigActiveRequestIds(await clientRedis.get(activeKey));
  const acknowledgedAt = new Date().toISOString();
  const ackData = {
    user: numericUser,
    sensorId: numericSensorId,
    payload,
    acknowledgedAt,
  };

  await clientRedis.set(
    getLoggerConfigAckKey(numericUser, numericSensorId),
    JSON.stringify(ackData),
    { EX: LOGGER_CONFIG_TTL_SECONDS }
  );

  if (requestIds.length === 0) return;

  for (const requestId of requestIds) {
    const pendingKey = getLoggerConfigPendingKey(requestId);
    const rawPending = await clientRedis.get(pendingKey);
    if (!rawPending) continue;

    let pending = {};
    try {
      pending = JSON.parse(rawPending);
    } catch (error) {
      continue;
    }
    const update = pending.update && typeof pending.update === "object" ? pending.update : null;

    if (update && Object.keys(update).length) {
      await Info.findOneAndUpdate(
        { id: Number(pending.sensorId || numericSensorId), user: Number(pending.user ?? numericUser) },
        { $set: update },
        { new: true }
      );
    }

    await clientRedis.set(
      pendingKey,
      JSON.stringify({
        ...pending,
        status: "acknowledged",
        acknowledgedAt,
        ack: payload,
      }),
      { EX: LOGGER_CONFIG_TTL_SECONDS }
    );
  }

  await removeLoggerConfigActiveRequests(numericUser, numericSensorId, requestIds);
}

let fcmAccessToken = null;
let fcmAccessTokenExpiresAt = 0;

const toBase64Url = (value) => Buffer
  .from(value)
  .toString("base64")
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");

const normalizePrivateKey = (key) => key?.replace(/\\n/g, "\n");

const getNotificationChannels = (sensorInfo) => ({
  telegram: sensorInfo?.notificationChannels?.telegram !== false,
  fcm: sensorInfo?.notificationChannels?.fcm === true,
});

const getSensorAlertLabel = (sensorInfo) => (
  sensorInfo?.id ? `${sensorInfo.id} - ${sensorInfo.name || "Logger"}` : (sensorInfo?.name || "Logger")
);

async function saveWarningHistory(sensorInfo, message, meta = {}) {
  if (!sensorInfo?.id) return;
  try {
    await Alarm.create({
      name: message,
      message,
      user: sensorInfo.user,
      sensorId: sensorInfo.id,
      sensorName: sensorInfo.name,
      group: sensorInfo.group || "Không có",
      type: meta.type || "warning",
      level: meta.level || "warning",
      value: Number.isFinite(Number(meta.value)) ? Number(meta.value) : undefined,
      createAt: new Date(),
    });
  } catch (error) {
    console.error("Không lưu được lịch sử cảnh báo:", error.message);
  }
}

async function getFcmAccessToken() {
  if (fcmAccessToken && Date.now() < fcmAccessTokenExpiresAt - 60000) {
    return fcmAccessToken;
  }

  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FCM_PRIVATE_KEY);
  if (!clientEmail || !privateKey) return null;

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

  fcmAccessToken = res.data.access_token;
  fcmAccessTokenExpiresAt = Date.now() + Number(res.data.expires_in || 3600) * 1000;
  return fcmAccessToken;
}

async function sendFcmMessage(message) {
  const projectId = process.env.FCM_PROJECT_ID;
  const token = await getFcmAccessToken();
  if (!projectId || !token) return false;

  const savedTokens = await FcmToken.find({ active: true }).distinct("token");
  const envTokens = (process.env.FCM_DEVICE_TOKENS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const deviceTokens = [...new Set([...savedTokens, ...envTokens])];
  const topic = process.env.FCM_TOPIC?.trim();
  const targets = topic ? [{ topic }] : deviceTokens.map((deviceToken) => ({ token: deviceToken }));
  if (targets.length === 0) return false;

  const results = await Promise.allSettled(targets.map(async (target) => {
    try {
      await axios.post(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          message: {
            ...target,
            webpush: {
              headers: {
                Urgency: "high",
              },
              fcm_options: {
                link: "https://khca-s.static.good-dns.net/",
              },
            },
            data: {
              type: "warning",
              title: "Cảnh báo IoT Water",
              message,
              body: message,
              icon: "/img/logo.jpeg",
              badge: "/img/logo.jpeg",
              tag: `iot-water-${Date.now()}`,
              link: "https://khca-s.static.good-dns.net/",
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return true;
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data || error.message;
      console.error("Lỗi FCM:", JSON.stringify({ status, target: target.topic ? "topic" : "token", detail }));
      if (target.token && (status === 400 || status === 404)) {
        await FcmToken.findOneAndUpdate(
          { token: target.token },
          { $set: { active: false, updatedAt: new Date() } }
        );
      }
      return false;
    }
  }));

  const successCount = results.filter((result) => result.status === "fulfilled" && result.value === true).length;
  console.log(`FCM gửi cảnh báo: ${successCount}/${targets.length} thiết bị nhận lệnh gửi`);
  return successCount > 0;
}

async function sendWarningNotification(sensorInfo, message, meta = {}) {
  await saveWarningHistory(sensorInfo, message, meta);
  const channels = getNotificationChannels(sensorInfo);
  const jobs = [];
  console.log(`Gửi cảnh báo: telegram=${channels.telegram}, fcm=${channels.fcm}, sensor=${sensorInfo?.id || "N/A"}, message="${message}"`);

  if (channels.telegram) {
    jobs.push(sendTelegramMessage(process.env.TOKEN, process.env.TELEGRAM_CHAT_ID, message));
  }
  if (channels.fcm) {
    jobs.push(sendFcmMessage(message));
  }

  const results = await Promise.allSettled(jobs);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Lỗi khi gửi cảnh báo:", result.reason?.message || result.reason);
    }
  });
}

cron.schedule('0 0 * * *', () => {
  let string2Send;
  axios.get('http://api.weatherapi.com/v1/forecast.json', {
    params: {
      key: 'ebb9d6aa8dfe4683bf323853251708',
      q: '21.290794,106.210799',
      days: 1,
      aqi: 'no',
      alerts: 'no'
    }
  })
    .then(res => {
      const day = res.data.forecast.forecastday[0]
      string2Send = Array.from({ length: 24 }, (_, i) => Math.floor(day.hour[i].temp_c)).join(' ') + ' ' + Math.floor(day.day.maxtemp_c) + ' ' + Math.floor(day.day.avgtemp_c);
    })   // JSON response
    .catch(err => console.error(err.message));
  allUser.forEach(async (User) => {
    const Prvs = allPrv[User]
    const info = await PrvInfo.find({ user: User });
    for (const key in Prvs) {
      if (key === null) continue;
      const id = Number(key)
      if (!isNaN(id) && info.temperature) {

      }
    }
  })
});

cron.schedule('*/6 * * * *', () => {
  allUser.forEach(async (User) => {
    const Sensors = allSensors[User]
    const Prvs = allPrv[User]

    for (const key in Sensors) {
      const id = Number(key)
      if (Sensors[key] !== 1 && key !== null && !isNaN(id)) {
        const currentDate = new Date(Date.now()).toLocaleString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        const info = await Info.findOne({ user: User, id: id });
        if (info?.isWarning) {
          await sendWarningNotification(
            info,
            `Cảnh báo mất kết nối logger ${getSensorAlertLabel(info)} vào lúc ${currentDate}`,
            { type: "lost_signal", level: "danger" }
          );
        }
      }
      allSensors[User][key] = 2;
    }
    for (const key in Prvs) {
      const id = Number(key)
      // console.log(Prvs[key], key, id)
      if (Prvs[key] !== 1 && key !== null && !isNaN(id)) {
        const currentDate = new Date(Date.now()).toLocaleString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        const info = await PrvInfo.findOne({ user: User, id: id });
        // console.log(info)
        if (info) {
          await sendWarningNotification(
            null,
            `Cảnh báo mất kết nối van ${info.name} vào lúc ${currentDate}`,
            { type: "lost_signal", level: "danger" }
          );
        }
      }
      allPrv[User][key] = 2;
    }
  });
});

// async function sendTelegramMessage(token, authorization, message, retries = 3) {
//   // const url = `https://api.telegram.org/bot${token}/sendMessage`;
//   const curlCommand = `curl -X POST https://discord.com/api/v9/channels/${token}/messages \
//   -H "Authorization: ${authorization}" \
//   -H "Content-Type: application/json" \
//   -d '{"content": "${message}"}'`;
//   for (let attempt = 1; attempt <= retries; attempt++) {
//     try {
//       exec(curlCommand);
//       return true;
//     } catch (error) {
//       console.error(`❌ Lỗi khi gửi tin nhắn (Lần ${attempt}):`, error.response ? error.response.data : error.message);
//       if (attempt === retries) {
//         return null;
//       }
//       await sleep(3000); // Chờ 3 giây trước khi thử lại
//     }
//   }
// }

async function sendTelegramMessage(token, chatId, message, retries = 3) {
  if (!token || !chatId) return false;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: message,
      });
      return true;
    } catch (error) {
      console.error(`❌ Lỗi khi gửi tin nhắn (Lần ${attempt}):`, error.response ? error.response.data : error.message);
      if (attempt === retries) {
        return null;
      }
      await sleep(3000); // Chờ 3 giây trước khi thử lại
    }
  }
}

const newSensor = async (user, id) => {
  try {
    const newSen = new Info({
      user: user,
      tracking: 0,
      interval: 60,
      wPress: 0,
      wPressTime: 0,
      timeAlarm: 300,
      watch: 60,
      adj: 0,
      id: id,
      name: id,
      lat: 0,
      lng: 0,
      group: "Không có",
      sample: 60,
      description: "",
      temperature: 25,
    })
    await newSen.save()
    const timestamp = Math.floor(Date.now() / 1000);
    client.publish(
      'watter/setInterval',
      JSON.stringify({ time: timestamp, sen_name: id }),
      (error) => {
        if (error) {
          return false
        } else {
          return true
        }
      }
    )
  } catch (error) {
    console.log(error)
  }
}


const connectMqtt = async () => {
  // let sumFlow = 0;
  allSensors[0] = {}
  for (const user of allUser) {
    const info = await Info.find({ user: user });
    const prvInfo = await PrvInfo.find({ user: user });
    if (info.length > 0) {
      info.forEach((sensor) => {
        if (!allSensors[user]) {
          allSensors[user] = {}
        }
        allSensors[user][sensor.id] = 1
        // fetchTimeAlarm(user, sensor.id)
      })
    }
    prvInfo.forEach((prv) => {
      if (!allPrv[user]) {
        allPrv[user] = {}
      }
      allPrv[user][prv.id] = 1
    })
  }
  client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 5000,
  });
  client.on("connect", () => {
    console.log("Connected to MQTT broker");
    client.subscribe(topic)
    client.subscribe(topicPrv)
    client.subscribe(topicPrvSend)
    client.subscribe(topic_config)
    client.subscribe(topicConfigAck)
  });

  client.on("message", async (topicRec, messageData) => {
    try {
      messageData = JSON.parse(messageData.toString());
      const sen_name = Number(messageData.n);
      if (isNaN(sen_name)) return;
      const user = Number(messageData.u) || 0;
      if (topicRec === topicConfigAck) {
        await markLoggerConfigAck({ user, sensorId: sen_name, payload: messageData });
        return;
      }
      if (topicRec === topic) {
        if (!allSensors[user][sen_name]) {
          newSensor(user, sen_name)
        }
        allSensors[user][sen_name] = 1
        const msg_id = Number(messageData.m);
        if (msg_id === 1) {
          const data = messageData.d
          data.forEach(async (message, index) => {
            message.t = message.t * 1000
            const newSensor = new Sensor({
              index: sen_name,
              user: user,
              battery: message.b || messageData.b,
              Pressure: message.p,
              temperature: messageData.t,
              sum: isNaN(messageData.s) ? 0 : messageData.s / 10,
              flow: message.f,
              createAt: message.t
            });
            await newSensor.save();
          })
        }
        else if (msg_id === 2) {
          const info = await Info.findOne({ id: sen_name, user });
          if (!info) return;
          const name = info.name
          const currentDate = new Date(Date.now()).toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false // Buộc không dùng định dạng 12 giờ 
          })
          if (messageData.res < info.wPressTime) {
            await sendWarningNotification(
              info,
              `Cảnh báo chưa đạt mức áp ${messageData.res}m tại cảm biến ${getSensorAlertLabel(info)} vào lúc ${currentDate}`,
              { type: "pressure_target", level: "warning", value: messageData.res }
            )
          }
        }
        else if (msg_id === 3) {
          const info = await Info.findOne({ id: sen_name, user });
          if (!info) return;
          const name = info.name
          const currentDate = new Date(Date.now()).toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false // Buộc không dùng định dạng 12 giờ 
          })
          if (messageData.t && info.temperature > 0) {
            await sendWarningNotification(
              info,
              `Cảnh báo nhiệt độ cao ${messageData.t}°C tại cảm biến ${getSensorAlertLabel(info)} vào lúc ${currentDate}`,
              { type: "temperature_high", level: "warning", value: messageData.t }
            )
          }
          if (messageData.p != null) {
            // client.publish("khca/warning", `{"n":${sen_name},"d":"warning"}`, { qos: 2 })
            let warningStr = ""
            await clientRedis.set(`warning:${sen_name}`, "warning", { EX: 60 });
            if (messageData.l === 0) {
              warningStr = `Cảnh báo áp suất cao trên ${messageData.p}m tại cảm biến ${getSensorAlertLabel(info)} vào lúc ${currentDate}`
              await sendWarningNotification(info, warningStr, { type: "pressure_high", level: "warning", value: messageData.p })
            }
            else {
              warningStr = `Cảnh báo áp suất thấp dưới ${messageData.p}m tại cảm biến ${getSensorAlertLabel(info)} vào lúc ${currentDate}`
              await sendWarningNotification(info, warningStr, { type: "pressure_low", level: "warning", value: messageData.p })
            }
          }
          if (messageData.f && Number(messageData.f) < 300) {
            // await sendTelegramMessage(process.env.TOKEN, process.env.AUTHORIZATION, `Cảnh báo lưu lượng cao ${messageData.f}m3/h tại cảm biến ${name} vào lúc ${currentDate}`)
          }
        }
      }
      else if (topicRec === topic_config) {
        const now = Math.floor((new Date()) / 1000);
        console.log(`logger/${sen_name}`)
        client.publish(
          `logger/${sen_name}`,
          JSON.stringify({ n: sen_name, m: 5, d:  now}),
          (error) => {
            if (error) {
              return false
            } else {
              return true
            }
          }
        )
      }
      else {
        const now = new Date();
        const seconds = now.getSeconds();
        if (topicRec === topicPrv) {
          allSensors[user][sen_name + 100] = 1
          if (seconds > 20) return;
          const newSensor = new Sensor({
            index: sen_name + 100,
            user: user,
            battery: messageData.b,
            Pressure: messageData.res,
            temperature: messageData.t || 0,
            sum: messageData.s,
            flow: messageData.f,
            createAt: now
          });
          await newSensor.save();
        }
        else if (topicRec === topicPrvSend) {
          allPrv[user][sen_name] = 1
          if (messageData.s) {
            const newPrvControl = new PrvControl({
              id: sen_name,
              user: user,
              control: messageData.s,
              min: messageData.min,
              max: messageData.max,
              time: messageData.g
            })
            await newPrvControl.save();
            return;
          }
          if (seconds > 10) return;
          const newPrv = new Prv({
            index: sen_name,
            user: user,
            Pressure1: messageData.p1,
            Pressure2: messageData.p2,
            Pressure3: messageData.i,
            battery: messageData.b,
            flow: messageData.f,
            temperature: messageData.t,
            createAt: now
          });
          await newPrv.save();
        }
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  });

  client.on("error", (err) => {
    console.error("Connection error:", err);
  });

  client.on("close", () => {
    console.log("Disconnected from MQTT broker");
  });

}

export default connectMqtt
