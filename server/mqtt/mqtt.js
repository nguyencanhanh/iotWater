import mqtt from "mqtt"
import Sensor from "../models/Sensor.js"
import Info from "../models/Info.js";
// import axios from 'axios';
import { exec } from 'child_process';

const allUser = [0]
const allSensors = []
const host = 'iotwater2024.mooo.com';
const port = 1883;
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`

const connectUrl = `mqtt://${host}:${port}`

const topic = 'iotwatter@2024'
export let client = null

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTelegramMessage(token, authorization, message, retries = 3) {
  // const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const curlCommand = `curl -X POST https://discord.com/api/v9/channels/${token}/messages \
  -H "Authorization: ${authorization}" \
  -H "Content-Type: application/json" \
  -d '{"content": "${message}"}'`;
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
  } catch (error) {
    console.log(error)
  }
}


const connectMqtt = async () => {
  // let sumFlow = 0;
  for (const user of allUser) {
    const info = await Info.find({ user: user });
    if (info.length > 0) {
      info.forEach((sensor) => {
        if (!allSensors[user]) {
          allSensors[user] = {}
        }
        allSensors[user][sensor.id] = 1
      })
    }
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
  });

  client.on("message", async (topic, messageData) => {
    try {
      messageData = JSON.parse(messageData.toString());
      const sen_name = Number(messageData.n);
      const user = Number(messageData.u) || 0;
      if (!allSensors[user][sen_name] && sen_name != 255) {
        newSensor(user, sen_name)
        allSensors[user][sen_name] = 1
      }
      const msg_id = Number(messageData.m);
      if (msg_id === 1) {
        const data = messageData.d
        // sumFlow = messageData.s
        // if (sumFlow) {
        //   await Flow.findOneAndUpdate({ sen_name: sen_name, user: user }, { $set: { sum: sumFlow } });
        //   //   sumFlow = 0
        // }
        data.forEach(async (message, index) => {
          message.t = message.t * 1000
          const newSensor = new Sensor({
            index: sen_name,
            user: user,
            battery: message.b || messageData.b,
            Pressure: message.p,
            temperature: messageData.t,
            sum: messageData.s,
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
          await sendTelegramMessage(process.env.TOKEN, process.env.AUTHORIZATION, `Cảnh báo chưa đạt mức áp ${messageData.res}m tại cảm biến ${name} vào lúc ${currentDate}`)
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
          await sendTelegramMessage(process.env.TOKEN, process.env.AUTHORIZATION, `Cảnh báo nhiệt độ cao ${messageData.t}°C tại cảm biến ${name} vào lúc ${currentDate}`)
        }
        if (messageData.p != null && info[0].wPress > 0) {
          await sendTelegramMessage(process.env.TOKEN, process.env.AUTHORIZATION, `Cảnh báo áp suất dưới thấp ${messageData.p}m tại cảm biến ${name} vào lúc ${currentDate}`)
        }
        if (messageData.f && Number(messageData.f) < 300) {
          await sendTelegramMessage(process.env.TOKEN, process.env.AUTHORIZATION, `Cảnh báo lưu lượng cao ${messageData.f}m3/h tại cảm biến ${name} vào lúc ${currentDate}`)
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
