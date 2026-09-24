import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import {
  createReportNow,
  getOverview,
  getTicker,
  listEvents,
  listLoggers,
  listReports,
  runNow,
  setFeedback,
  testTelegram,
  updateLoggerMode,
  updateSettings,
} from "../controllers/monitorController.js";

const router = express.Router();

router.get("/overview", verifyUser, getOverview);
router.get("/ticker", verifyUser, getTicker);
router.get("/events", verifyUser, listEvents);
router.post("/events/:id/feedback", verifyUser, setFeedback);
router.get("/reports", verifyUser, listReports);
router.post("/reports", verifyUser, createReportNow);
router.post("/run", verifyUser, runNow);
router.get("/loggers", verifyUser, listLoggers);
router.put("/loggers/:id", verifyUser, updateLoggerMode);
router.put("/settings", verifyUser, updateSettings);
router.post("/test-telegram", verifyUser, testTelegram);

export default router;
