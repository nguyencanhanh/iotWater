import express from "express";
import { addSensor, getSensors, deleteSensor, updateSensor, viewSensor, exportSensors, saveDataPost, upInterval} from "../controllers/sensorController.js";
import verifyUser from "../middleware/authMiddleware.js";

const router = express.Router()

router.post('/' , verifyUser , getSensors )
router.post('/add' , verifyUser , addSensor )
router.get('/data/:id' , verifyUser , viewSensor )
router.put('/data/:id' , verifyUser , updateSensor )
router.delete('/:id' , verifyUser , deleteSensor)
router.post('/export' , verifyUser , exportSensors )
router.post('/save' , verifyUser , saveDataPost )
router.post('/data/intervalUp' , verifyUser, upInterval )



export default router