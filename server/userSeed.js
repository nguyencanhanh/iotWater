import connectToDatabase from './db/db.js'
import User from './models/User.js'
import bcrypt from 'bcrypt'

const userRegister = async () => {
  connectToDatabase()
  try {
    const hashPassword = await bcrypt.hash("2", 10)
    const user = new User({
      name: "guest",
      email: "cnbg@gmail.com",
      password: hashPassword,
      role: "trial"
    })
    await user.save()

  } catch (error) {
    console.log(error)
  }
}

userRegister();