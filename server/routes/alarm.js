import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import {addAlarm, getAlarm, deleteAlarm } from "../controllers/sensorController.js";

const router = express.Router()

router.post('/' , verifyUser , getAlarm );
router.post('/add' , verifyUser, addAlarm )
router.post('/delete' , verifyUser, deleteAlarm )
// router.post('/warning' , verifyUser, deleteAlarm )

export default router