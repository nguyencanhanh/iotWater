import express from "express"
const router = express.Router();
import { login, verify } from "../controllers/authController.js";
import verifyUser from "../middleware/authMiddleware.js";

router.post('/login' , login)
router.get('/verify' , verifyUser , verify)

export default router;