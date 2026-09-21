import express from 'express'
import cors from 'cors'
import fs from "fs";
import path from "path";
import bodyParser from 'body-parser';
import authRouter from './routes/auth.js'
import sensorRouter from './routes/sensor.js'
import groupSensor from './routes/group.js'
// import alarmRouter from './routes/alarm.js'
import uploadImg from './routes/upload.js'
import prvRouter from './routes/prv.js'
import dmaRouter from './routes/dma.js'
import dnpConfigRouter from './routes/dnpConfig.js'
import generalSettingRouter from './routes/generalSetting.js'
import externalLoggerRouter from './routes/externalLogger.js'
import trafficRouter from './routes/traffic.js'
import chatbotRouter from './routes/chatbot.js'
import aiRouter from './routes/ai.js'
import mapPointRouter from './routes/mapPoint.js'
import connectToDatabase from './db/db.js'
import connectMqtt from './mqtt/mqtt.js'
import connectRedis from './mqtt/redis.js';

const disableMqtt = /^(1|true|yes)$/i.test(String(process.env.DISABLE_MQTT || ""));

connectToDatabase()
if (!disableMqtt) connectMqtt()
else console.log("MQTT disabled by DISABLE_MQTT")
connectRedis()
const app = express()
// Domain duoc phep goi API. Them domain moi bang bien CORS_ORIGINS trong .env
// (ngan cach bang dau phay), khong can sua code.
const defaultOrigins = ['https://khca-s.static.good-dns.net']
const extraOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const originWhitelist = [...new Set([...defaultOrigins, ...extraOrigins])]

const isLocalOrigin = (origin) => origin.includes('localhost')
  || origin.includes('127.0.0.1')
  || origin.includes(':8088')
  || origin.includes(':8080')
  || origin.includes(':8443')

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (originWhitelist.includes(origin) || isLocalOrigin(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS tu choi origin: ${origin}`)
    return callback(new Error('Not allowed by CORS'));
  }
}))
app.use(express.json())
app.use(bodyParser.raw({ type: 'image/jpeg', limit: '5mb' }));
app.set("trust proxy", true); // nếu có nginx/ngrok

const logFilePath = path.join(process.cwd(), "access.log"); // file nằm ngay trong thư mục project
const accessLogStream = fs.createWriteStream(logFilePath, { flags: "a" });

accessLogStream.on("error", (err) => {
  console.error("Error writing access log:", err);
});

app.use((req, res, next) => {
  const xff = req.headers["x-forwarded-for"];
  const ip = xff ? xff.split(",")[0].trim() : (req.socket.remoteAddress || req.ip);
  const time = new Date().toISOString();
  const ua = req.headers["user-agent"];
  const logLine = `[${time}] ${ip} -> ${req.method} ${req.originalUrl} | UA: ${ua}\n`;

  accessLogStream.write(logLine);

  next();
});
app.use('/api/auth', authRouter)
app.use('/api/upload', uploadImg)
app.use('/api/sensor', sensorRouter)
app.use('/api/group', groupSensor)
// app.use('/api/alarm', alarmRouter)
app.use('/api/prv', prvRouter)
app.use('/api/dma', dmaRouter)
app.use('/api/dnp-config', dnpConfigRouter)
app.use('/api/general-settings', generalSettingRouter)
app.use('/api/external-loggers', externalLoggerRouter)
app.use('/api/traffic', trafficRouter)
app.use('/api/chatbot', chatbotRouter)
app.use('/api/ai', aiRouter)
app.use('/api/map-points', mapPointRouter)

// Chi nghe tren localhost. nginx da proxy /api/ nen web khong anh huong,
// nhung port 3000 khong con phoi thang ra internet (bo qua HTTPS + rate limit).
const LISTEN_HOST = process.env.LISTEN_HOST || '127.0.0.1'

app.listen(process.env.PORT, LISTEN_HOST, ()=>{
  console.log(`Server is Running on ${LISTEN_HOST}:${process.env.PORT}`)
})
