import connectToDatabase from './db/db.js'
import Info from './models/Info.js'

const userRegister = async () => {
  connectToDatabase()
  try {
    const newSen = new Info({
      user: 0,
      tracking: 0,
      interval: 60,
      wPress: 0,
      wPressTime: 0,
      timeAlarm: 300,
      watch: 60,
      adj: 0,
      id: 103,
      name: "Điểm cuối prv 3",
      lat: 0,
      lng: 0,
      group: "Không có",
      sample: 60,
      description: "",
      temperature: 25,
    })
    await newSen.save()
  } catch (error) {
    console.log(error)
  }
}

userRegister();