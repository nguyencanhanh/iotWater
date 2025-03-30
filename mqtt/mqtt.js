import mqtt from 'mqtt'
import { CronJob, timeout } from 'cron'
import appConstant from './constant.js';


const host = 'iotwater2024.mooo.com';
const port = 1883;
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`

const connectUrl = `mqtt://${host}:${port}`
const client = mqtt.connect(connectUrl, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 5000,
})

const topic = 'watter/setInterval'
client.on('connect', () => {
  console.log('Connected')
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

new CronJob(
  appConstant.EVERY_DAY,
  async function () {
    const timeNow = Math.floor(Date.now() / 1000 + 3)
    client.publish(
      'watter/setInterval',
      JSON.stringify({ sen_name: 255, time: timeNow })
    )
  },
  null,  // cb when job stop
  true,  // auto start
)
