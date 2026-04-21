import mqtt from "mqtt"
import Sensor from "../models/Sensor.js"
import Info from "../models/Info.js";
import Prv from "../models/PrvData.js";
import PrvInfo from "../models/Prv.js";
import PrvControl from "../models/PrvControl.js"
import Alarm from "../models/AlarmFlow.js";
import cron from 'node-cron'
import axios from 'axios';
// import { fetchTimeAlarm } from "../controllers/sensorController.js"
import { exec } from 'child_process';
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
export let client = null

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
          await sendTelegramMessage(
            process.env.TOKEN,
            process.env.TELEGRAM_CHAT_ID,
            `Cảnh báo mất kết nối logger ${info.name} vào lúc ${currentDate}`
          );
        }
      }
      allSensors[User][key] = 2;
    }
    console.log(Prvs)
    for (const key in Prvs) {
      const id = Number(key)
      console.log(Prvs[key], key, id)
      if (Prvs[key] !== 1 && key !== null && !isNaN(id)) {
        const currentDate = new Date(Date.now()).toLocaleString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        const info = await PrvInfo.findOne({ user: User, id: id });
        console.log(info)
        if (info) {
          await sendTelegramMessage(
            process.env.TOKEN,
            process.env.TELEGRAM_CHAT_ID,
            `Cảnh báo mất kết nối van ${info.name} vào lúc ${currentDate}`
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
  // const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const curlCommand = `curl -X POST "https://api.telegram.org/bot${token}/sendMessage" \
     -H "Content-Type: application/json" \
     -d '{"chat_id": "${chatId}", "text": "${message}"}'`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      exec(curlCommand);
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
  });

  client.on("message", async (topicRec, messageData) => {
    try {
      messageData = JSON.parse(messageData.toString());
      const sen_name = Number(messageData.n);
      if (isNaN(sen_name)) return;
      const user = Number(messageData.u) || 0;
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
              index: sen_name ,
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
          const info = await Info.find({ id: sen_name });
          const name = info[0].name
          const currentDate = new Date(Date.now()).toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false // Buộc không dùng định dạng 12 giờ 
          })
          if (messageData.res < info[0].wPressTime) {
            await sendTelegramMessage(process.env.TOKEN, process.env.TELEGRAM_CHAT_ID, `Cảnh báo chưa đạt mức áp ${messageData.res}m tại cảm biến ${name} vào lúc ${currentDate}`)
          }
        }
        else if (msg_id === 3) {
          const info = await Info.find({ id: sen_name });
          const name = info[0].name
          const currentDate = new Date(Date.now()).toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false // Buộc không dùng định dạng 12 giờ 
          })
          if (messageData.t && info[0].temperature > 0) {
            await sendTelegramMessage(process.env.TOKEN, process.env.TELEGRAM_CHAT_ID, `Cảnh báo nhiệt độ cao ${messageData.t}°C tại cảm biến ${name} vào lúc ${currentDate}`)
          }
          if (messageData.p != null) {
            // client.publish("khca/warning", `{"n":${sen_name},"d":"warning"}`, { qos: 2 })
            let  warningStr = ""
            await clientRedis.set(`warning:${sen_name}`, "warning", { EX: 60 });
            if (messageData.l === 0) {
              warningStr = `Cảnh báo áp suất cao trên ${messageData.p}m tại cảm biến ${name} vào lúc ${currentDate}`
              await sendTelegramMessage(process.env.TOKEN, process.env.TELEGRAM_CHAT_ID, warningStr)
            }
            else {
              warningStr = `Cảnh báo áp suất thấp dưới ${messageData.p}m tại cảm biến ${name} vào lúc ${currentDate}`
              await sendTelegramMessage(process.env.TOKEN, process.env.TELEGRAM_CHAT_ID, warningStr)
            }
            const newAlarm  = new Alarm({
              name: warningStr
            })
            await newAlarm.save()
          }
          if (messageData.f && Number(messageData.f) < 300) {
            // await sendTelegramMessage(process.env.TOKEN, process.env.AUTHORIZATION, `Cảnh báo lưu lượng cao ${messageData.f}m3/h tại cảm biến ${name} vào lúc ${currentDate}`)
          }
        }
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
