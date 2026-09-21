import mongoose from "mongoose";

const dmaSchema = new mongoose.Schema({
  user: { type: Number, required: true },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  group: { type: String, default: "" },
  parentDmaId: { type: mongoose.Schema.Types.ObjectId, ref: "Dma", default: null },
  inletLoggerIds: [Number],
  consumeLoggerIds: [Number],
  sensorLinks: [
    {
      parentId: Number,
      childId: Number,
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

dmaSchema.index({ user: 1, name: 1 }, { unique: true });
dmaSchema.index({ user: 1, updatedAt: -1 });

const Dma = mongoose.model("Dma", dmaSchema);

export default Dma;
