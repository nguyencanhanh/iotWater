import express from 'express'
import cors from 'cors'
import fs from "fs";
import path from "path";
import bodyParser from 'body-parser';
import authRouter from './routes/auth.js'
import sensorRouter from './routes/sensor.js'
import groupSensor from './routes/group.js'
import alarmRouter from './routes/alarm.js'
import uploadImg from './routes/upload.js'
import prvRouter from './routes/prv.js'
import connectToDatabase from './db/db.js'
import connectMqtt from './mqtt/mqtt.js'
import connectRedis from './mqtt/redis.js';

connectToDatabase()
connectMqtt()
connectRedis()
const app = express()
app.use(cors({origin: ['https://iotwater2024.mooo.com']}))
app.use(express.json())
app.use(bodyParser.raw({ type: 'image/jpeg', limit: '5mb' }));
app.set("trust proxy", true); // nếu có nginx/ngrok

const logFilePath = path.join(process.cwd(), "access.log"); // file nằm ngay trong thư mục project

app.use((req, res, next) => {
  const xff = req.headers["x-forwarded-for"];
  const ip = xff ? xff.split(",")[0].trim() : (req.socket.remoteAddress || req.ip);
  const time = new Date().toISOString();
  const ua = req.headers["user-agent"];
  const logLine = `[${time}] ${ip} -> ${req.method} ${req.originalUrl} | UA: ${ua}\n`;

  fs.appendFile(logFilePath, logLine, (err) => {
    if (err) console.error("Error writing log:", err);
  });

  next();
});
app.use('/api/auth', authRouter)
app.use('/api/upload', uploadImg)
app.use('/api/sensor', sensorRouter)
app.use('/api/group', groupSensor)
app.use('/api/alarm', alarmRouter)
app.use('/api/prv', prvRouter)

app.listen(process.env.PORT, ()=>{
  console.log(`Server is Running on port ${process.env.PORT}`)
})