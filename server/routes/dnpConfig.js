import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import { getDnpConfig, updateDnpConfig } from "../controllers/dnpConfigController.js";

const router = express.Router();

router.get("/", verifyUser, getDnpConfig);
router.put("/", verifyUser, updateDnpConfig);

export default router;
