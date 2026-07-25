import express from "express";
import { addSensor, analyzeSensorReport, createHomeMessage, deleteHomeMessage, getHomeMessages, getLoggerConfigStatus, getSensorProduction, getSensorReport, getSensors, getTodayWarningHistory, updateSensor, viewSensor, exportSensors, exportDailyReport, upInterval} from "../controllers/sensorController.js";
import verifyUser from "../middleware/authMiddleware.js";

const router = express.Router()

router.post('/' , verifyUser , getSensors )
router.post('/add' , verifyUser , addSensor )
router.post('/viewSen' , verifyUser , viewSensor )
router.post('/updateSen' , verifyUser , updateSensor )
router.post('/export' , verifyUser , exportSensors )
router.post('/data/intervalUp' , verifyUser, upInterval )
router.get('/data/config-status' , verifyUser, getLoggerConfigStatus )
router.post('/production' , verifyUser, getSensorProduction )
router.get('/home-messages' , verifyUser, getHomeMessages )
router.post('/home-messages' , verifyUser, createHomeMessage )
router.delete('/home-messages/:id' , verifyUser, deleteHomeMessage )
router.get('/warning-history/today' , verifyUser, getTodayWarningHistory )
router.post('/report' , verifyUser, getSensorReport )
router.post('/report/ai-analysis' , verifyUser, analyzeSensorReport )
router.post('/report/daily-export' , verifyUser, exportDailyReport )



export default router
