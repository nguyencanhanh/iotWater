import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import sensorRouter from './routes/sensor.js'
import groupSensor from './routes/group.js'
import connectToDatabase from './db/db.js'
import connectMqtt from './mqtt/mqtt.js'
import {Schedule} from './controllers/sensorController.js'

connectToDatabase()
connectMqtt()
Schedule()
const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/sensor', sensorRouter)
app.use('/api/group', groupSensor)

app.listen(process.env.PORT, "0.0.0.0", ()=>{
  console.log(`Server is Running on port ${process.env.PORT}`)
})