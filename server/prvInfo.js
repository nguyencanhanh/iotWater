import connectToDatabase from './db/db.js'
import Info from './models/Prv.js'

const userRegister = async () => {
  connectToDatabase()
  try {
    const info = new Info({
        user: 0,
        id: 838361398,
        idMatch: 1,
        mode: 0,
        name: "Van mới",
        unit: 100,
        temperature: 30,
        timeNextControl: 100,
        percent: 95,
        minSet: 5.5,
        maxSet: 16.5,
        minSetAM: 13.0,
        maxSetAM: 17.0,
        time_top: "17:00",
        time_bot: "06:30",
        timeout1: 10,
        timeout2: 10,
        flowClose: 55,
        range: [2, 1],
        onOff: [0, 0],
        open1:["05:00", "06:00", 14.2],
        open2:["05:00", "06:00", 14.3],
        pConfig: [34.0,28.0,30.0,20.0,34.0,25.0,10.7],
        timeAlarm: [300,480,660,840,1020,1200,1380]
    })
    await info.save()
  } catch (error) {
    console.log(error)
  }
}

userRegister();