import mqtt from 'mqtt'
import { CronJob} from 'cron'
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
  appConstant.EVERY_1MINUTE,
  async function () {
    const time = new Date();
    const timeStamp = Math.floor(time.getTime() / 1000);
    console.log("publish success")
    client.publish(topic, JSON.stringify({
      sen_name: 0,
      createAt: timeStamp,
      Pressure: Math.random() * 1000,
      battery: Math.random() * 100 | 0,
      msg_id: 1,
    }))
    await sleep(400)
    client.publish(topic, JSON.stringify({
      sen_name: 1,
      createAt: timeStamp,
      Pressure: Math.random() * 1000,
      battery: Math.random() * 100 | 0,
      msg_id: 1,
    }))
  },
  null,  // cb when job stop
  true,  // auto start
)