import connectToDatabase from './db/db.js'
import User from './models/User.js'
import bcrypt from 'bcrypt'

const userRegister = async () => {
  connectToDatabase()
  try {
    const hashPassword = await bcrypt.hash("2", 10)
    const info = await User.findOneAndUpdate({
      name: "guest",
      email: "dnpbg@gmail.com",
      role: "trial",
    }, { $set: { email: 'cnbg@gmail.com', password: hashPassword } }, { new: true })
  } catch (error) {
    console.log(error)
  }
}

userRegister();