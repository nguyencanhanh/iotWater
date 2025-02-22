import mqtt from 'mqtt'
import { CronJob } from 'cron'
import appConstant from './constant.js';


const host = 'broker.hivemq.com';
const port = 1883;
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`

const connectUrl = `mqtt://${host}:${port}`
const client = mqtt.connect(connectUrl, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 5000,
})

const topic = 'iotwatter@2024'
client.on('connect', () => {
  console.log('Connected')
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

new CronJob(
  appConstant.EVERY_10MINUTE,
  async function () {
    let time = Date.now() - 9 * 60000;
    console.log("published")
    const data = []
    for (let i = 0; i < 10; i++) {
      data.push({
        createAt: time + i * 60000,
        Pressure: Math.random() * 3,
        battery: Math.random() * 100 | 0,
        temperature: Math.random() * 100 | 0,
      })
    }
    client.publish(topic, JSON.stringify({
      sen_name: 0,
      msg_id: 1,
      data: data
    }))
    await sleep(400)
    time = Date.now()
    client.publish(topic, JSON.stringify({
      sen_name: 1,
      msg_id: 1,
      data: [{
        createAt: time - 60000 * 5,
        Pressure: Math.random() * 3,
        battery: Math.random() * 100 | 0,
        temperature: Math.random() * 100 | 0,
      },
      {
        createAt: time,
        Pressure: Math.random() * 3,
        battery: Math.random() * 100 | 0,
        temperature: Math.random() * 100 | 0,
      },
      ]
    }))
  },
  null,  // cb when job stop
  true,  // auto start
)