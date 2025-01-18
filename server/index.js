import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import sensorRouter from './routes/sensor.js'
import connectToDatabase from './db/db.js'

connectToDatabase()
const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/sensor', sensorRouter)

app.listen(process.env.PORT, "0.0.0.0", ()=>{
  console.log(`Server is Running on port ${process.env.PORT}`)
})