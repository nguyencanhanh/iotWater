import IncidentGroup from "../models/IncidentGroup.js";
import MapPoint from "../models/MapPoint.js";

const getUserNumber = (req, source) => {
  const raw = Number(source?.user);
  return Number.isFinite(raw) ? raw : Number(req.user?.user ?? 0);
};

const isReadOnlyRole = (req) => req.user?.role === "trial";
const cleanName = (value) => String(value || "").trim().slice(0, 120);

// Danh sach nhom su co do nguoi dung tu them, KHONG lay tu nhom logger. Chi bo sung
// nhom da duoc dung o diem su co (du lieu cu) de khong diem nao co nhom "mo coi".
const syncGroups = async (user) => {
  const names = (await MapPoint.distinct("group", { user })).map(cleanName).filter(Boolean);
  if (!names.length) return;

  const existing = new Set((await IncidentGroup.find({ user, name: { $in: names } }).select("name").lean()).map((item) => item.name));
  const missing = names.filter((name) => !existing.has(name));
  if (!missing.length) return;
  const last = await IncidentGroup.findOne({ user }).sort({ sortOrder: -1 }).select("sortOrder").lean();
  const start = Number(last?.sortOrder ?? -1) + 1;
  await IncidentGroup.insertMany(
    missing.map((name, index) => ({ user, name, sortOrder: start + index })),
    { ordered: false }
  ).catch(() => null);
};

export const listIncidentGroups = async (req, res) => {
  try {
    const user = getUserNumber(req, req.query);
    await syncGroups(user);
    const groups = await IncidentGroup.find({ user }).sort({ sortOrder: 1, name: 1 }).lean();
    return res.status(200).json({ success: true, groups });
  } catch (error) {
    console.error("Không tải được nhóm sự cố:", error.message);
    return res.status(500).json({ success: false, error: "Không tải được nhóm sự cố" });
  }
};

export const createIncidentGroup = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không thêm được nhóm" });
  }
  try {
    const user = getUserNumber(req, req.body);
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ success: false, error: "Vui lòng nhập tên nhóm" });

    const existing = await IncidentGroup.findOne({ user, name }).lean();
    if (existing) return res.status(200).json({ success: true, group: existing, existed: true });

    const last = await IncidentGroup.findOne({ user }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const group = await IncidentGroup.create({ user, name, sortOrder: Number(last?.sortOrder ?? -1) + 1 });
    return res.status(201).json({ success: true, group });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : 500).json({ success: false, error: duplicate ? "Nhóm đã tồn tại" : "Không tạo được nhóm" });
  }
};

export const updateIncidentGroup = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không sửa được nhóm" });
  }
  try {
    const user = getUserNumber(req, req.body);
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ success: false, error: "Vui lòng nhập tên nhóm" });

    const current = await IncidentGroup.findOne({ _id: req.params.id, user }).lean();
    if (!current) return res.status(404).json({ success: false, error: "Không tìm thấy nhóm" });
    if (current.name === name) return res.status(200).json({ success: true, group: current, renamed: 0 });

    const group = await IncidentGroup.findOneAndUpdate(
      { _id: req.params.id, user },
      { $set: { name } },
      { new: true, runValidators: true }
    ).lean();
    // Diem luu ten nhom dang chuoi -> doi theo ten moi.
    const result = await MapPoint.updateMany({ user, group: current.name }, { $set: { group: name } });
    return res.status(200).json({ success: true, group, renamed: result.modifiedCount || 0, oldName: current.name });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : 500).json({ success: false, error: duplicate ? "Nhóm đã tồn tại" : "Không cập nhật được nhóm" });
  }
};

export const deleteIncidentGroup = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không xoá được nhóm" });
  }
  try {
    const user = getUserNumber(req, req.query);
    const group = await IncidentGroup.findOne({ _id: req.params.id, user }).lean();
    if (!group) return res.status(404).json({ success: false, error: "Không tìm thấy nhóm" });

    const used = await MapPoint.countDocuments({ user, group: group.name });
    if (used > 0) {
      return res.status(409).json({ success: false, error: `Nhóm đang được dùng ở ${used} điểm, không xoá được` });
    }
    await IncidentGroup.deleteOne({ _id: group._id });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Không xoá được nhóm sự cố:", error.message);
    return res.status(500).json({ success: false, error: "Không xoá được nhóm" });
  }
};
