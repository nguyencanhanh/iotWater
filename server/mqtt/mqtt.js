import mqtt from "mqtt"
import Sensor from "../models/Sensor.js"
import Info from "../models/User.js";
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '../.env' });

const host = 'broker.hivemq.com';
const port = 1883;
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`

const connectUrl = `mqtt://${host}:${port}`

const topic = 'iotwatter@2024'

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
  const client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 5000,
  });
  client.on("connect", () => {
    console.log("Connected to MQTT broker");
    client.subscribe(topic)
  });

  const info = await Info.findOne({});

  client.on("message", (topic, messageData) => {
    try {
      const check = []
      messageData = JSON.parse(messageData.toString());
      const sen_name = Number(messageData.sen_name);
      const msg_id = Number(messageData.msg_id)
      messageData.data.forEach(async (message) => {
        if (msg_id === 1) {
          const newSensor = new Sensor({
            index: sen_name,
            battery: message.battery,
            temperature: message.temperature,
            Pressure: message.Pressure,
            createAt: message.createAt
          });
          if(message.temperature >= info.temperature && check.length === 0){
            check[0] = message.temperature
            check[1] = new Date(message.createAt).toLocaleString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false // Buộc không dùng định dạng 12 giờ
            })
          }
          await newSensor.save();
        }
      })
      if(check.length > 0){
        sendTelegramMessage(process.env.TOKEN, process.env.TELEGRAM_CHAT_ID, `Cảnh báo nhiệt độ cao ${check[0]}°C tại cảm biến ${info.sen_id[sen_name].name} vào lúc ${check[1]}`)
        check = []
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