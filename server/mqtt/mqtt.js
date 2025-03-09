import mqtt from "mqtt"
import Sensor from "../models/Sensor.js"
import Info from "../models/Info.js";
import axios from 'axios';

let checkTime = false
const host = 'iotwater2024.mooo.com';
const port = 1883;
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`

const connectUrl = `mqtt://${host}:${port}`

const topic = 'iotwatter@2024'
export let client = null

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTelegramMessage(token, chatId, message, retries = 3) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        params: {
          chat_id: chatId,
          text: message
        }
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Lỗi khi gửi tin nhắn (Lần ${attempt}):`, error.response ? error.response.data : error.message);
      if (attempt === retries) {
        return null;
      }
      await sleep(3000); // Chờ 3 giây trước khi thử lại
    }
  }
}

const connectMqtt = async () => {
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
      const sen_name = Number(messageData.sen_name);
      const info = await Info.find({ id: sen_name });
      const msg_id = Number(messageData.msg_id)
      if (msg_id === 1) {
        const timeFake = info[0].sample * 1000;
        const dateNow = Date.now() - (messageData.data.length - 1) * timeFake;
        const timeCheck = Math.abs(messageData.data[0].createAt * 1000 - dateNow)
        if (Number(timeCheck) > 100000) {
          checkTime = true
        }
        else {
          checkTime = false
        }
        messageData.data.forEach(async (message, index) => {
          if (checkTime) {
            message.createAt = dateNow + (index + 1) * timeFake;
          }
          else {
            message.createAt = message.createAt * 1000
          }
          const newSensor = new Sensor({
            index: sen_name,
            battery: message.battery,
            temperature: message.temperature,
            Pressure: message.Pressure,
            createAt: message.createAt
          });
          await newSensor.save();
        })
      }
      else if (msg_id === 3) {
        const name = info[0].name
        const currentDate = new Date(Date.now()).toLocaleString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false // Buộc không dùng định dạng 12 giờ 
        })
        if (messageData.t && info[0].temperature > 0) {
          await sendTelegramMessage(process.env.TOKEN, process.env.TELEGRAM_CHAT_ID, `Cảnh báo nhiệt độ cao ${messageData.t}°C tại cảm biến ${name} vào lúc ${currentDate}`)
        }
        if (messageData.p && info[0].wPress > 0) {
          await sendTelegramMessage(process.env.TOKEN, process.env.TELEGRAM_CHAT_ID, `Cảnh báo áp suất dưới thấp ${messageData.p}Bar tại cảm biến ${name} vào lúc ${currentDate}`)
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
