import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser';
import authRouter from './routes/auth.js'
import sensorRouter from './routes/sensor.js'
import groupSensor from './routes/group.js'
import alarmRouter from './routes/alarm.js'
import uploadImg from './routes/upload.js'
import connectToDatabase from './db/db.js'
import connectMqtt from './mqtt/mqtt.js'

connectToDatabase()
connectMqtt()
const app = express()
app.use(cors())
app.use(express.json())
app.use(bodyParser.raw({ type: 'image/jpeg', limit: '5mb' }));
app.use('/api/auth', authRouter)
app.use('/api/upload', uploadImg)
app.use('/api/sensor', sensorRouter)
app.use('/api/group', groupSensor)
app.use('/api/alarm', alarmRouter)

app.listen(process.env.PORT, ()=>{
  console.log(`Server is Running on port ${process.env.PORT}`)
})