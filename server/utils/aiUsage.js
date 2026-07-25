import AiUsage from "../models/AiUsage.js";

const DEFAULT_AI_DAILY_LIMIT = 10;
const USAGE_TTL_DAYS = 45;

const getDateKey = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

const getDailyLimit = () => {
  const limit = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_AI_DAILY_LIMIT;
};

const getUserNumber = (req) => {
  const user = Number(req.user?.user ?? req.body?.user ?? req.query?.user ?? 0);
  return Number.isFinite(user) ? user : 0;
};

const getExpiresAt = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + USAGE_TTL_DAYS);
  return expiresAt;
};

const toMeta = ({ usage, limit, user, dateKey }) => {
  const used = Math.max(0, Number(usage?.count ?? 0));
  return {
    user,
    dateKey,
    limit,
    used,
    remaining: Math.max(limit - used, 0),
  };
};

const createLimitError = ({ limit, used, user, dateKey }) => {
  const error = new Error(`Đã dùng hết ${limit} lượt AI hôm nay. Vui lòng thử lại vào ngày mai.`);
  error.statusCode = 429;
  error.aiUsage = {
    user,
    dateKey,
    limit,
    used: Math.max(used, limit),
    remaining: 0,
  };
  return error;
};

export const acquireAiUsage = async (req) => {
  const limit = getDailyLimit();
  const user = getUserNumber(req);
  const dateKey = getDateKey();
  const update = {
    $inc: { count: 1 },
    $set: {
      userId: req.user?._id,
      updatedAt: new Date(),
      expiresAt: getExpiresAt(),
    },
    $setOnInsert: { user, dateKey },
  };

  try {
    const usage = await AiUsage.findOneAndUpdate(
      { user, dateKey, count: { $lt: limit } },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    if (usage) return { ...toMeta({ usage, limit, user, dateKey }), counted: true };
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  const retryUsage = await AiUsage.findOneAndUpdate(
    { user, dateKey, count: { $lt: limit } },
    {
      $inc: { count: 1 },
      $set: {
        userId: req.user?._id,
        updatedAt: new Date(),
        expiresAt: getExpiresAt(),
      },
    },
    { new: true }
  ).lean();

  if (retryUsage) return { ...toMeta({ usage: retryUsage, limit, user, dateKey }), counted: true };

  const currentUsage = await AiUsage.findOne({ user, dateKey }).lean();
  throw createLimitError({
    limit,
    used: Number(currentUsage?.count ?? limit),
    user,
    dateKey,
  });
};

export const releaseAiUsage = async (usageMeta) => {
  if (!usageMeta?.counted) return null;

  const usage = await AiUsage.findOneAndUpdate(
    { user: usageMeta.user, dateKey: usageMeta.dateKey, count: { $gt: 0 } },
    {
      $inc: { count: -1 },
      $set: { updatedAt: new Date() },
    },
    { new: true }
  ).lean();

  return usage ? toMeta({
    usage,
    limit: usageMeta.limit,
    user: usageMeta.user,
    dateKey: usageMeta.dateKey,
  }) : null;
};

export const respondAiLimit = (res, error) => res.status(error.statusCode || 429).json({
  success: false,
  error: error.message || "Đã dùng hết lượt AI hôm nay",
  aiUsage: error.aiUsage,
});
