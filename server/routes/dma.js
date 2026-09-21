import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import { analyzeDma, analyzeDmaStream, calculateDma, createDma, deleteDma, listDma, updateDma } from "../controllers/dmaController.js";

const router = express.Router();

router.get("/", verifyUser, listDma);
router.post("/", verifyUser, createDma);
router.put("/:id", verifyUser, updateDma);
router.delete("/:id", verifyUser, deleteDma);
router.post("/calculate", verifyUser, calculateDma);
router.post("/analyze", verifyUser, analyzeDma);
router.post("/analyze/stream", verifyUser, analyzeDmaStream);

export default router;
