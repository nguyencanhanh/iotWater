import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import {
  createMapPoint,
  deleteMapPoint,
  getMapPointHotspots,
  listMapPoints,
  updateMapPoint,
} from "../controllers/mapPointController.js";

const router = express.Router();

router.get("/", verifyUser, listMapPoints);
router.get("/hotspots", verifyUser, getMapPointHotspots);
router.post("/", verifyUser, createMapPoint);
router.put("/:id", verifyUser, updateMapPoint);
router.delete("/:id", verifyUser, deleteMapPoint);

export default router;
