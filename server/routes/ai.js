import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import { getAiHealth, probeProviders } from "../services/ai/index.js";

const router = express.Router();

router.get("/health", verifyUser, (req, res) => {
  res.status(200).json({ success: true, health: getAiHealth() });
});

router.get("/probe", verifyUser, async (req, res) => {
  const probes = await probeProviders();
  const healthy = Object.values(probes).some((probe) => probe.ok);
  res.status(healthy ? 200 : 503).json({ success: healthy, probes, health: getAiHealth() });
});

export default router;
