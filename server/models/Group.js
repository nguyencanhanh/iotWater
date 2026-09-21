import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  user: {type: Number},
  name: {type: String},
  sortOrder: { type: Number, default: 0 },
  createAt: { type: Date, default: Date.now }
})

groupSchema.index({ user: 1, sortOrder: 1 });
groupSchema.index({ user: 1, name: 1 });

const Group = mongoose.model("Group", groupSchema)

export default Group;
