import IncidentGroup from "../models/IncidentGroup.js";
import { dropLegacyNameIndex, makeCatalogController } from "../services/incidentCatalog.js";

const migrated = new Set();

// Nhom cu de phang (khong co parentId) -> thanh khu vuc bac 1.
const migrateLegacy = async (user) => {
  if (migrated.has(user)) return;
  await dropLegacyNameIndex(IncidentGroup);
  await IncidentGroup.updateMany({ user, parentId: { $exists: false } }, { $set: { parentId: null } });
  migrated.add(user);
};

const toCustomers = (value) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 ? Math.min(number, 10000000) : null;
};

const controller = makeCatalogController({
  Model: IncidentGroup,
  levels: 2,
  label: "khu vực / tuyến",
  listKey: "groups",
  pointFields: {
    parent: { id: "areaId", name: "areaName" },
    child: { id: "routeId", name: "routeName" },
  },
  // So khach hang chi co o tuyen (bac 2).
  pickExtra: (body, { isChild }) => {
    const customers = toCustomers(body.customers);
    return isChild && body.customers !== undefined && customers !== null ? { customers } : {};
  },
  // Truong "group" cu luu ten khu vuc bac 1 (bo loc khu vuc o phan bao cao dang dung).
  extraParentSync: (name) => ({ group: name }),
  prepare: migrateLegacy,
});

export const listIncidentGroups = controller.list;
export const createIncidentGroup = controller.create;
export const updateIncidentGroup = controller.update;
export const deleteIncidentGroup = controller.remove;
