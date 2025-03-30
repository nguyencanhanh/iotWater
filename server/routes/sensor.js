import express from "express";
import { addSensor, getSensors, updateSensor, viewSensor, exportSensors, upInterval} from "../controllers/sensorController.js";
import verifyUser from "../middleware/authMiddleware.js";

const router = express.Router()

router.post('/' , verifyUser , getSensors )
router.post('/add' , verifyUser , addSensor )
router.post('/viewSen' , verifyUser , viewSensor )
router.post('/updateSen' , verifyUser , updateSensor )
router.post('/export' , verifyUser , exportSensors )
router.post('/data/intervalUp' , verifyUser, upInterval )



export default router