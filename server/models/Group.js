import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  user: {type: Number},
  name: {type: String},
  createAt: { type: Date, default: Date.now }
})

const Group = mongoose.model("Group", groupSchema)

export default Group;