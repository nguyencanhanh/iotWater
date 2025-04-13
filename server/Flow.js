import connectToDatabase from './db/db.js'
import Flow from './models/SumFlow.js'

const userRegister = async () => {
  connectToDatabase()
  try {
    for(let i = 0; i < 5; i++){
        const flow = new Flow({
          user: 0,
          sen_name: i,
          sum: 1000
        })
        await flow.save()
    }
  } catch (error) {
    console.log(error)
  }
}

userRegister();