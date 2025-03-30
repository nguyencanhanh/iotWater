import connectToDatabase from './db/db.js'
import Info from './models/Group.js'

const userRegister = async () => {
  connectToDatabase()
  try {
    const info = new Info({
      name: "dongque"
    })
    await info.save()
  } catch (error) {
    console.log(error)
  }
}

userRegister();