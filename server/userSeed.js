import connectToDatabase from './db/db.js'
import User from './models/User.js'
import bcrypt from 'bcrypt'

const userRegister = async () => {
  connectToDatabase()
  try {
    const hashPassword = await bcrypt.hash("1", 10)
    const info = new User({
      name: "canhanh",
      email: "admin@gmail.com",
      password: hashPassword,
      role: "admin",
      total: 3,
      interval: 300,
      sample: 300,
      tracking: 1.5,
      trackingB: 1.3,
      sen_id: [
        { name: "bacgiang1", id: 0 },
        { name: "bacgiang2", id: 1 },
        { name: "bacgiang3", id: 2 },
      ],
    })
    await info.save()
  } catch (error) {
    console.log(error)
  }
}

userRegister();