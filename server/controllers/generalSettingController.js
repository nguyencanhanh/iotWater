import GeneralSetting from "../models/GeneralSetting.js";
import {
  DEFAULT_GENERAL_SETTING,
  normalizeGeneralSetting,
  normalizeGeneralSettingUpdate,
} from "../services/generalSetting.js";

const getRequestUser = (req) => {
  const bodyUser = Number(req.body?.user);
  const queryUser = Number(req.query?.user);
  if (Number.isFinite(bodyUser)) return bodyUser;
  if (Number.isFinite(queryUser)) return queryUser;
  return Number(req.user?.user ?? 0);
};

export const getGeneralSetting = async (req, res) => {
  try {
    const user = getRequestUser(req);
    const setting = await GeneralSetting.findOne({ user }).lean();
    return res.status(200).json({
      success: true,
      setting: setting ? { ...setting, ...normalizeGeneralSetting(setting) } : {
        user,
        ...DEFAULT_GENERAL_SETTING,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không tải được cài đặt chung" });
  }
};

export const updateGeneralSetting = async (req, res) => {
  try {
    const user = getRequestUser(req);
    const current = await GeneralSetting.findOne({ user }).lean();
    const payload = {
      user,
      ...normalizeGeneralSettingUpdate(req.body, current || DEFAULT_GENERAL_SETTING),
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
