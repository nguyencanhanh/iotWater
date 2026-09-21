import express from "express";
import multer from "multer";
import path from "path";
import verifyUser from "../middleware/authMiddleware.js";
import {
  INCIDENT_IMAGE_DIR,
  addMapPointImages,
  createMapPoint,
  deleteMapPoint,
  deleteMapPointImage,
  exportMapPoints,
  getMapPointHotspots,
  getMapPointImage,
  getMapPointReport,
  listMapPoints,
  updateMapPoint,
} from "../controllers/mapPointController.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, INCIDENT_IMAGE_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
    cb(null, `incident_${req.params.id}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

router.get("/", verifyUser, listMapPoints);
router.get("/hotspots", verifyUser, getMapPointHotspots);
router.get("/report", verifyUser, getMapPointReport);
router.post("/export", verifyUser, exportMapPoints);
router.post("/", verifyUser, createMapPoint);
router.put("/:id", verifyUser, updateMapPoint);
router.delete("/:id", verifyUser, deleteMapPoint);

router.post("/:id/images", verifyUser, upload.array("files", 10), addMapPointImages);
router.delete("/:id/images/:name", verifyUser, deleteMapPointImage);
router.get("/image/:name", getMapPointImage);

export default router;
