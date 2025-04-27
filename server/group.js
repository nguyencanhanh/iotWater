import connectToDatabase from './db/db.js'
import Info from './models/Info.js'

const userRegister = async () => {
  connectToDatabase()
  // for(let i =0; i < 5; i++){
    try {
      await Info.findOneAndUpdate(
        { id: 0, user: 0 },
        {
          $set: {
            group: "Không có" // Thêm name vào đây
          }
        },
        { new: true }
      );
    } catch (error) {
      console.log(error)
    }
  // }
}

userRegister();