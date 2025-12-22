import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import {getPrv, addPrvTime, deletePrvTime, changePrv, getAllPrv} from "../controllers/prvController.js";

const router = express.Router()

router.post('/' , verifyUser , getPrv );
router.post('/add' , verifyUser, addPrvTime )
router.delete('/delete' , verifyUser, deletePrvTime )
router.put('/change' , verifyUser,  changePrv)
router.get('/get' , verifyUser,  getAllPrv)

export default router