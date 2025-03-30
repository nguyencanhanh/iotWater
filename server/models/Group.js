import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  user: {type: Number},
  name: {type: String}
})

const Group = mongoose.model("Group", groupSchema)

export default Group;