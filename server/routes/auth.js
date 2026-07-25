import express from "express"
const router = express.Router();
import { login, verify, info, registerFcmToken, unregisterFcmToken, sendFcmTest } from "../controllers/authController.js";
import verifyUser from "../middleware/authMiddleware.js";

router.post('/login' , login)
router.get('/verify' , verifyUser , verify)
router.get('/info' , verifyUser , info)
router.post('/fcm-token' , verifyUser , registerFcmToken)
router.delete('/fcm-token' , verifyUser , unregisterFcmToken)
router.post('/fcm-test' , verifyUser , sendFcmTest)

export default router;
