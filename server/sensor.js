import connectToDatabase from './db/db.js'
import Info from './models/Info.js'

const userRegister = async () => {
  connectToDatabase()
  try {
    const info = new Info({
      interval: 300,
      sample: 300,
      tracking: 1.5,
      sen_id: 2,
      name: "bacgiang3",
      lat: 21.054073,
      lng: 105.179155,
      temperature: 99
    })
    await info.save()
  } catch (error) {
    console.log(error)
  }
}

userRegister();