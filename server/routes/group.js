import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import { getGroup, changeGroup, deleteGroup, addGroup, getGroupInfo, getSensorInGroup } from "../controllers/sensorController.js";

const router = express.Router()

router.post('/' , verifyUser , getGroup )
router.post('/info' , verifyUser , getGroupInfo )
router.post('/group' , verifyUser , getSensorInGroup )
router.put('/change' , verifyUser, changeGroup )
router.post('/delete' , verifyUser, deleteGroup )
router.post('/add' , verifyUser, addGroup )

export default router