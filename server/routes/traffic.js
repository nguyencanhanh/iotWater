import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import { readTrafficStats, recordTrafficHeartbeat } from "../controllers/trafficController.js";

const router = express.Router();

router.get("/stats", verifyUser, readTrafficStats);
router.post("/heartbeat", verifyUser, recordTrafficHeartbeat);

export default router;
