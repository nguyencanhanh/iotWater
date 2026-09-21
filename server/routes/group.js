import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import { getGroup, changeGroup, deleteGroup, addGroup, getGroupInfo, getSensorInGroup, updateSensorOrder, updateGroupOrder } from "../controllers/sensorController.js";

const router = express.Router()

router.get('/' , verifyUser , getGroup )
router.get('/info' , verifyUser , getGroupInfo )
router.get('/group' , verifyUser , getSensorInGroup )
router.put('/change' , verifyUser, changeGroup )
router.post('/delete' , verifyUser, deleteGroup )
router.post('/add' , verifyUser, addGroup )
router.post('/update-order' , verifyUser, updateSensorOrder )
router.post('/update-group-order' , verifyUser, updateGroupOrder )

export default router
