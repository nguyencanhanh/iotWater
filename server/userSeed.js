import connectToDatabase from './db/db.js'
import User from './models/User.js'
import bcrypt from 'bcrypt'

const userRegister = async () => {
  connectToDatabase()
  try {
    const hashPassword = await bcrypt.hash("trial", 10)
    const info = new User({
      name: "guest",
      email: "guest@gmail.com",
      password: hashPassword,
      role: "trial",
    })
    await info.save()
  } catch (error) {
    console.log(error)
  }
}

userRegister();