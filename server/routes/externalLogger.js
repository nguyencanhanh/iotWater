import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import {
  getExternalLoggerData,
  listExternalLoggerPoints,
  listExternalLoggerProviders,
  refreshExternalLoggerToken,
} from "../controllers/externalLoggerController.js";

const router = express.Router();

router.get("/providers", verifyUser, listExternalLoggerProviders);
router.post("/:provider/refresh-token", verifyUser, refreshExternalLoggerToken);
router.get("/:provider/points", verifyUser, listExternalLoggerPoints);
router.get("/:provider/:number/data", verifyUser, getExternalLoggerData);

export default router;
