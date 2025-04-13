import mongoose from "mongoose";

const SumFlow = new mongoose.Schema({
  user: {type: Number},
  sen_name: {type: Number},
  sum: {type: Number}
})

const Flow = mongoose.model("Flow", SumFlow)

export default Flow;