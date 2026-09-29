import express from "express";
import verifyUser from "../middleware/authMiddleware.js";
import {
  createIncidentGroup,
  deleteIncidentGroup,
  listIncidentGroups,
  updateIncidentGroup,
} from "../controllers/incidentGroupController.js";

const router = express.Router();

router.get("/", verifyUser, listIncidentGroups);
router.post("/", verifyUser, createIncidentGroup);
router.put("/:id", verifyUser, updateIncidentGroup);
router.delete("/:id", verifyUser, deleteIncidentGroup);

export default router;
