import mongoose from "mongoose";
import MapPoint from "../models/MapPoint.js";

// Bo xu ly chung cho cac danh muc cua diem su co (them / sua / xoa / chuyen nhom):
//   - Loai su co 2 bac  (IncidentType: typeGroupId/Name <- bac 1, typeId/Name <- bac 2)
//   - Khu vuc 2 bac     (IncidentGroup: areaId/Name <- bac 1, routeId/Name <- bac 2)
//   - Loai hinh phat hien 1 bac (IncidentMethod: methodId/Name)
// Diem su co luu kem TEN (snapshot) de bao cao khong phai join, nen doi ten / chuyen nhom
// o day phai dong bo sang cac diem dang dung.

const getUserNumber = (req, source) => {
  const raw = Number(source?.user);
  return Number.isFinite(raw) ? raw : Number(req.user?.user ?? 0);
};

const isReadOnlyRole = (req) => req.user?.role === "trial";
const cleanName = (value) => String(value || "").trim().slice(0, 120);
const isObjectId = (value) => mongoose.isValidObjectId(value);

const duplicateError = (error) => error?.code === 11000;

export const makeCatalogController = ({
  Model,
  levels,
  label,
  // { parent: { id, name }, child: { id, name } } cho 2 bac; { child: {...} } cho 1 bac.
  pointFields,
  // (body, { isChild, current }) -> cac truong rieng (icon, customers...) hop le
  pickExtra = () => ({}),
  // Dong bo them khi doi ten bac 1 (vd khu vuc bac 1 con luu o truong "group" cu).
  extraParentSync = () => ({}),
  prepare = async () => {},
  // Ten khoa cu trong response (types / groups) de khong vo cac cho dang doc.
  listKey = "items",
}) => {
  const childField = pointFields.child;
  const parentField = pointFields.parent;

  const list = async (req, res) => {
    try {
      const user = getUserNumber(req, req.query);
      await prepare(user);
      const items = await Model.find({ user }).sort({ sortOrder: 1, name: 1 }).lean();
      return res.status(200).json({ success: true, items, [listKey]: items });
    } catch (error) {
      console.error(`Không tải được ${label}:`, error.message);
      return res.status(500).json({ success: false, error: `Không tải được ${label}` });
    }
  };

  const resolveParent = async (user, parentId) => {
    if (levels < 2 || !parentId) return null;
    if (!isObjectId(parentId)) throw Object.assign(new Error("Nhóm cha không hợp lệ"), { status: 400 });
    const parent = await Model.findOne({ _id: parentId, user, parentId: null }).lean();
    if (!parent) throw Object.assign(new Error("Không tìm thấy nhóm cha (bậc 1)"), { status: 400 });
    return parent;
  };

  const create = async (req, res) => {
    if (isReadOnlyRole(req)) return res.status(403).json({ success: false, error: `Tài khoản dùng thử không thêm được ${label}` });
    try {
      const user = getUserNumber(req, req.body);
      const name = cleanName(req.body?.name);
      if (!name) return res.status(400).json({ success: false, error: "Vui lòng nhập tên" });
      const parent = await resolveParent(user, req.body?.parentId);
      const parentId = parent?._id || null;

      const existing = await Model.findOne({ user, parentId, name }).lean();
      if (existing) return res.status(200).json({ success: true, item: existing, existed: true });

      const last = await Model.findOne({ user }).sort({ sortOrder: -1 }).select("sortOrder").lean();
      const item = await Model.create({
        user,
        name,
        parentId,
        sortOrder: Number(last?.sortOrder ?? -1) + 1,
        ...pickExtra(req.body || {}, { isChild: Boolean(parentId) }),
      });
      return res.status(201).json({ success: true, item });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ success: false, error: error.message });
      return res.status(duplicateError(error) ? 409 : 500).json({
        success: false,
        error: duplicateError(error) ? "Tên này đã có trong nhóm" : `Không tạo được ${label}`,
      });
    }
  };

  const update = async (req, res) => {
    if (isReadOnlyRole(req)) return res.status(403).json({ success: false, error: `Tài khoản dùng thử không sửa được ${label}` });
    try {
      const user = getUserNumber(req, req.body);
      const current = await Model.findOne({ _id: req.params.id, user }).lean();
      if (!current) return res.status(404).json({ success: false, error: `Không tìm thấy ${label}` });
      const isChild = Boolean(current.parentId);

      const set = { ...pickExtra(req.body || {}, { isChild, current }) };
      if (req.body?.name !== undefined) {
        const name = cleanName(req.body.name);
        if (!name) return res.status(400).json({ success: false, error: "Vui lòng nhập tên" });
        set.name = name;
      }
      // Chi cho chuyen bac 2 sang bac 1 khac (khong doi bac).
      let newParent = null;
      if (levels >= 2 && isChild && req.body?.parentId && String(req.body.parentId) !== String(current.parentId)) {
        newParent = await resolveParent(user, req.body.parentId);
        set.parentId = newParent._id;
      }

      const item = await Model.findOneAndUpdate({ _id: current._id, user }, { $set: set }, { new: true, runValidators: true }).lean();

      // Dong bo ten / nhom cha sang cac diem dang dung.
      if (isChild || levels < 2) {
        const pointSet = {};
        if (set.name && set.name !== current.name) pointSet[childField.name] = set.name;
        if (newParent && parentField) {
          pointSet[parentField.id] = newParent._id;
          pointSet[parentField.name] = newParent.name;
          Object.assign(pointSet, extraParentSync(newParent.name));
        }
        if (Object.keys(pointSet).length) await MapPoint.updateMany({ user, [childField.id]: current._id }, { $set: pointSet });
      } else if (parentField && set.name && set.name !== current.name) {
        await MapPoint.updateMany(
          { user, [parentField.id]: current._id },
          { $set: { [parentField.name]: set.name, ...extraParentSync(set.name) } }
        );
      }
      return res.status(200).json({ success: true, item, oldName: current.name });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ success: false, error: error.message });
      return res.status(duplicateError(error) ? 409 : 500).json({
        success: false,
        error: duplicateError(error) ? "Tên này đã có trong nhóm" : `Không cập nhật được ${label}`,
      });
    }
  };

  const remove = async (req, res) => {
    if (isReadOnlyRole(req)) return res.status(403).json({ success: false, error: `Tài khoản dùng thử không xoá được ${label}` });
    try {
      const user = getUserNumber(req, req.query);
      const current = await Model.findOne({ _id: req.params.id, user }).lean();
      if (!current) return res.status(404).json({ success: false, error: `Không tìm thấy ${label}` });

      if (levels >= 2 && !current.parentId) {
        const children = await Model.countDocuments({ user, parentId: current._id });
        if (children > 0) {
          return res.status(409).json({ success: false, error: `Nhóm còn ${children} mục bậc 2, hãy xoá hoặc chuyển chúng trước` });
        }
      }
      const field = levels >= 2 && !current.parentId ? parentField.id : childField.id;
      const used = await MapPoint.countDocuments({ user, [field]: current._id });
      if (used > 0) {
        return res.status(409).json({ success: false, error: `Đang được dùng ở ${used} điểm, không xoá được` });
      }
      await Model.deleteOne({ _id: current._id });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(`Không xoá được ${label}:`, error.message);
      return res.status(500).json({ success: false, error: `Không xoá được ${label}` });
    }
  };

  return { list, create, update, remove };
};

// Bo index unique (user, name) cu: gio ten chi can khong trung TRONG cung nhom cha.
export const dropLegacyNameIndex = async (Model) => {
  try {
    await Model.collection.dropIndex("user_1_name_1");
  } catch {
    // Khong co index cu - binh thuong.
  }
};
