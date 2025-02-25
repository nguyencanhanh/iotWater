import express from "express"
const router = express.Router();
import { login, verify, info } from "../controllers/authController.js";
import verifyUser from "../middleware/authMiddleware.js";

router.post('/login' , login)
router.get('/verify' , verifyUser , verify)
router.get('/info' , verifyUser , info)

export default router;