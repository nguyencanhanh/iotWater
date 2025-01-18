import Sensor from './models/Sensor.js'
import connectToDatabase from './db/db.js'

const userRegister = async () => {
  connectToDatabase()
  try {
    // const hashPassword = await bcrypt.hash("admin", 10)
    const info = new Sensor({
     index: 1,
     Pressure: 20
    })
    await info.save()
  } catch (error) {
    console.log(error)
  }
}

userRegister();