import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import {
  createIncidentMethod,
  deleteIncidentMethod,
  listIncidentMethods,
  updateIncidentMethod,
} from "../controllers/incidentMethodController.js";

const router = express.Router();

router.get("/", verifyUser, listIncidentMethods);
router.post("/", verifyUser, createIncidentMethod);
router.put("/:id", verifyUser, updateIncidentMethod);
router.delete("/:id", verifyUser, deleteIncidentMethod);

export default router;
