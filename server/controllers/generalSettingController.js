import GeneralSetting from "../models/GeneralSetting.js";

const DEFAULT_MAP_TOOLTIP_MIN_ZOOM = 15;

const getRequestUser = (req) => {
  const bodyUser = Number(req.body?.user);
  const queryUser = Number(req.query?.user);
  if (Number.isFinite(bodyUser)) return bodyUser;
  if (Number.isFinite(queryUser)) return queryUser;
  return Number(req.user?.user ?? 0);
};

const normalizeZoom = (value) => {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return DEFAULT_MAP_TOOLTIP_MIN_ZOOM;
  return Math.min(Math.max(Math.round(zoom), 1), 22);
};

export const getGeneralSetting = async (req, res) => {
  try {
    const user = getRequestUser(req);
    const setting = await GeneralSetting.findOne({ user }).lean();
    return res.status(200).json({
      success: true,
      setting: setting || {
        user,
        mapTooltipMinZoom: DEFAULT_MAP_TOOLTIP_MIN_ZOOM,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không tải được cài đặt chung" });
  }
};

export const updateGeneralSetting = async (req, res) => {
  try {
    const user = getRequestUser(req);
    const payload = {
      user,
      mapTooltipMinZoom: normalizeZoom(req.body.mapTooltipMinZoom),
      updatedAt: new Date(),
    };
    const setting = await GeneralSetting.findOneAndUpdate(
      { user },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({ success: true, setting });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không lưu được cài đặt chung" });
  }
};
