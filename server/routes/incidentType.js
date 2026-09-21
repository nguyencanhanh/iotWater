import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import {
  createIncidentType,
  deleteIncidentType,
  listIncidentTypes,
  updateIncidentType,
} from "../controllers/incidentTypeController.js";

const router = express.Router();

router.get("/", verifyUser, listIncidentTypes);
router.post("/", verifyUser, createIncidentType);
router.put("/:id", verifyUser, updateIncidentType);
router.delete("/:id", verifyUser, deleteIncidentType);

export default router;
