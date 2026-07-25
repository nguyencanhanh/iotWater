import DnpConfig from "../models/DnpConfig.js";

const normalizeIds = (ids) => [...new Set((ids || []).map(Number).filter((id) => Number.isFinite(id)))];

const getRequestUser = (req) => {
  const bodyUser = Number(req.body?.user);
  const queryUser = Number(req.query?.user);
  if (Number.isFinite(bodyUser)) return bodyUser;
  if (Number.isFinite(queryUser)) return queryUser;
  return Number(req.user?.user ?? 0);
};

export const getDnpConfig = async (req, res) => {
  try {
    const user = getRequestUser(req);
    const config = await DnpConfig.findOne({ user }).lean();
    return res.status(200).json({
      success: true,
      config: config || { user, name: "DNP", loggerIds: [] },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không tải được cấu hình DNP" });
  }
};

export const updateDnpConfig = async (req, res) => {
  try {
    const user = getRequestUser(req);
    const payload = {
      user,
      name: req.body.name || "DNP",
      loggerIds: normalizeIds(req.body.loggerIds),
      updatedAt: new Date(),
    };
    const config = await DnpConfig.findOneAndUpdate(
      { user },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({ success: true, config });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không lưu được cấu hình DNP" });
  }
};
