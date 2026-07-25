import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import { getGeneralSetting, updateGeneralSetting } from "../controllers/generalSettingController.js";

const router = express.Router();

router.get("/", verifyUser, getGeneralSetting);
router.put("/", verifyUser, updateGeneralSetting);

export default router;
