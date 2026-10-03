import IncidentType from "../models/IncidentType.js";
import MapPoint from "../models/MapPoint.js";
import { dropLegacyNameIndex, makeCatalogController } from "../services/incidentCatalog.js";

// Bieu tuong cho phep (phai khop frontend/src/components/map/pointIcons.js).
export const TYPE_ICONS = ["drop", "faucet", "pipe", "valve", "meter", "tee", "elbow", "wrench", "warning"];

const DEFAULT_PARENT = "Chung";
const DEFAULT_CHILDREN = ["Vỡ ống", "Rò rỉ mối nối", "Rò rỉ van", "Rò rỉ đồng hồ", "Nứt gãy cút ren", "Khác"];
const LEGACY_PARENT = "Chưa phân nhóm";

const migrated = new Set();

// Loai cu de phang (khong co truong parentId) -> dua vao nhom bac 1 "Chua phan nhom"
// de diem dang dung van la loai bac 2. Chay 1 lan moi user, an toan khi chay lai.
const migrateLegacy = async (user) => {
  if (migrated.has(user)) return;
  await dropLegacyNameIndex(IncidentType);
  const legacy = await IncidentType.find({ user, parentId: { $exists: false } }).lean();
  if (legacy.length) {
    const parent = await IncidentType.findOneAndUpdate(
      { user, parentId: null, name: LEGACY_PARENT },
      { $setOnInsert: { user, parentId: null, name: LEGACY_PARENT, sortOrder: -1 } },
      { new: true, upsert: true }
    ).lean();
    await IncidentType.updateMany(
      { user, _id: { $in: legacy.map((item) => item._id) } },
      { $set: { parentId: parent._id, icon: "drop" } }
    );
    await MapPoint.updateMany(
      { user, typeId: { $in: legacy.map((item) => item._id) } },
      { $set: { typeGroupId: parent._id, typeGroupName: parent.name } }
    );
  }
  migrated.add(user);
};

export const ensureDefaultTypes = async (user) => {
  await migrateLegacy(user);
  if (await IncidentType.countDocuments({ user }) > 0) return;
  const parent = await IncidentType.create({ user, name: DEFAULT_PARENT, parentId: null, sortOrder: 0 });
  await IncidentType.insertMany(
    DEFAULT_CHILDREN.map((name, index) => ({ user, name, parentId: parent._id, icon: "drop", sortOrder: index + 1 })),
    { ordered: false }
  ).catch(() => null);
};

const controller = makeCatalogController({
  Model: IncidentType,
  levels: 2,
  label: "loại sự cố",
  listKey: "types",
  pointFields: {
    parent: { id: "typeGroupId", name: "typeGroupName" },
    child: { id: "typeId", name: "typeName" },
  },
  pickExtra: (body, { isChild }) => (
    isChild && TYPE_ICONS.includes(body.icon) ? { icon: body.icon } : {}
  ),
  prepare: ensureDefaultTypes,
});

export const listIncidentTypes = controller.list;
export const createIncidentType = controller.create;
export const updateIncidentType = controller.update;
export const deleteIncidentType = controller.remove;
