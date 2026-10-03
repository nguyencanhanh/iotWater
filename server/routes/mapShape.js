import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import { createMapShape, deleteMapShape, listMapShapes, updateMapShape } from "../controllers/mapShapeController.js";

const router = express.Router();

router.get("/", verifyUser, listMapShapes);
router.post("/", verifyUser, createMapShape);
router.put("/:id", verifyUser, updateMapShape);
router.delete("/:id", verifyUser, deleteMapShape);

export default router;
