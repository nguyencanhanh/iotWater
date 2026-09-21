import express from "express";
import { chatWithAssistant } from "../controllers/chatbotController.js";
import verifyUser from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/message", verifyUser, chatWithAssistant);

export default router;
