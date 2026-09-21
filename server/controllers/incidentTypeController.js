import IncidentType from "../models/IncidentType.js";
import MapPoint from "../models/MapPoint.js";

// Bo loai mac dinh, tao mot lan cho moi user. Nguoi dung tu them tiep tuy dia ban.
const DEFAULT_TYPES = [
  "Vỡ ống",
  "Rò rỉ mối nối",
  "Rò rỉ van",
  "Rò rỉ đồng hồ",
  "Nứt gãy cút ren",
  "Khác",
];

const getUserNumber = (req, source) => {
  const raw = Number(source?.user);
  return Number.isFinite(raw) ? raw : Number(req.user?.user ?? 0);
};

const isReadOnlyRole = (req) => req.user?.role === "trial";

export const ensureDefaultTypes = async (user) => {
  const count = await IncidentType.countDocuments({ user });
  if (count > 0) return;

  await IncidentType.insertMany(
    DEFAULT_TYPES.map((name, index) => ({ user, name, sortOrder: index })),
    { ordered: false }
  ).catch(() => null);
};

export const listIncidentTypes = async (req, res) => {
  try {
    const user = getUserNumber(req, req.query);
    await ensureDefaultTypes(user);

    const types = await IncidentType.find({ user })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return res.status(200).json({ success: true, types });
  } catch (error) {
    console.error("Không tải được loại sự cố:", error.message);
    return res.status(500).json({ success: false, error: "Không tải được loại sự cố" });
  }
};

export const createIncidentType = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không thêm được loại sự cố" });
  }

  try {
    const user = getUserNumber(req, req.body);
    const name = String(req.body?.name || "").trim().slice(0, 120);
    if (!name) return res.status(400).json({ success: false, error: "Vui lòng nhập tên loại sự cố" });

    const existing = await IncidentType.findOne({ user, name }).lean();
    if (existing) return res.status(200).json({ success: true, type: existing, existed: true });

    const last = await IncidentType.findOne({ user }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const type = await IncidentType.create({
      user,
      name,
      sortOrder: Number(last?.sortOrder ?? -1) + 1,
    });

    return res.status(201).json({ success: true, type });
  } catch (error) {
    const message = error?.code === 11000 ? "Loại sự cố đã tồn tại" : "Không tạo được loại sự cố";
    return res.status(error?.code === 11000 ? 409 : 500).json({ success: false, error: message });
  }
};

export const updateIncidentType = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không sửa được loại sự cố" });
  }

  try {
    const user = getUserNumber(req, req.body);
    const name = String(req.body?.name || "").trim().slice(0, 120);
    if (!name) return res.status(400).json({ success: false, error: "Vui lòng nhập tên loại sự cố" });

    const type = await IncidentType.findOneAndUpdate(
      { _id: req.params.id, user },
      { $set: { name } },
      { new: true, runValidators: true }
    ).lean();

    if (!type) return res.status(404).json({ success: false, error: "Không tìm thấy loại sự cố" });

    // Giu ten hien thi cua cac diem cu dong bo theo ten moi.
    await MapPoint.updateMany({ user, typeId: type._id }, { $set: { typeName: name } });

    return res.status(200).json({ success: true, type });
  } catch (error) {
    const message = error?.code === 11000 ? "Loại sự cố đã tồn tại" : "Không cập nhật được loại sự cố";
    return res.status(error?.code === 11000 ? 409 : 500).json({ success: false, error: message });
  }
};

export const deleteIncidentType = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không xoá được loại sự cố" });
  }

  try {
    const user = getUserNumber(req, req.query);
    const used = await MapPoint.countDocuments({ user, typeId: req.params.id });
    if (used > 0) {
      return res.status(409).json({
        success: false,
        error: `Loại sự cố đang được dùng ở ${used} điểm, không xoá được`,
      });
    }

    const deleted = await IncidentType.findOneAndDelete({ _id: req.params.id, user }).lean();
    if (!deleted) return res.status(404).json({ success: false, error: "Không tìm thấy loại sự cố" });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Không xoá được loại sự cố:", error.message);
    return res.status(500).json({ success: false, error: "Không xoá được loại sự cố" });
  }
};
