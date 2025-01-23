import mqtt from "mqtt"
import Sensor from "../models/Sensor.js"

const host = 'broker.hivemq.com';
const port = 1883;
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`

const connectUrl = `mqtt://${host}:${port}`

const topic = 'iotwatter@2024'

const connectMqtt = () => {
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

  client.on("message", (topic, messageData) => {
    try {
      messageData = JSON.parse(messageData.toString());
      const sen_name = Number(messageData.sen_name);
      const msg_id = Number(messageData.msg_id)
      messageData.data.forEach(async (message) => {
        if (msg_id === 1) {
          const newSensor = new Sensor({
            index: sen_name,
            battery: message.battery,
            Pressure: message.Pressure,
            createAt: message.createAt
          });
          await newSensor.save();
        }
      })
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