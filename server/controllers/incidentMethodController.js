import IncidentMethod from "../models/IncidentMethod.js";
import { makeCatalogController } from "../services/incidentCatalog.js";

// Loai hinh phat hien: danh sach phang, nguoi dung tu them (khong tao san).
const controller = makeCatalogController({
  Model: IncidentMethod,
  levels: 1,
  label: "loại hình phát hiện",
  listKey: "methods",
  pointFields: { child: { id: "methodId", name: "methodName" } },
});

export const listIncidentMethods = controller.list;
export const createIncidentMethod = controller.create;
export const updateIncidentMethod = controller.update;
export const deleteIncidentMethod = controller.remove;
