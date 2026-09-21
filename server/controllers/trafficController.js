import PresenceSession from "../models/PresenceSession.js";
import TrafficStat from "../models/TrafficStat.js";
import { clientRedis } from "../mqtt/redis.js";

const onlineWindowMs = 3 * 60 * 1000;
const sessionCacheSeconds = 7 * 24 * 60 * 60;
const onlineKeys = {
  mobile: "traffic:online:mobile",
  desktop: "traffic:online:desktop",
};

const isRedisReady = () => clientRedis?.isReady === true;

const normalizeDeviceType = (value, userAgent = "") => {
  if (["mobile", "desktop"].includes(value)) return value;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(userAgent)
    ? "mobile"
    : "desktop";
};

const readOnlineCounts = async () => {
  if (isRedisReady()) {
    try {
      const cutoff = Date.now() - onlineWindowMs;
      await Promise.all(Object.values(onlineKeys).map((key) => clientRedis.zRemRangeByScore(key, 0, cutoff)));
      const [mobile, desktop] = await Promise.all([
        clientRedis.zCard(onlineKeys.mobile),
        clientRedis.zCard(onlineKeys.desktop),
      ]);
      return { mobile: Number(mobile || 0), desktop: Number(desktop || 0) };
    } catch {
      // MongoDB remains a fallback if Redis is temporarily unavailable.
    }
  }

  const onlineGroups = await PresenceSession.aggregate([
    { $match: { lastSeen: { $gte: new Date(Date.now() - onlineWindowMs) } } },
    { $group: { _id: "$deviceType", count: { $sum: 1 } } },
  ]);
  const onlineByDevice = Object.fromEntries(onlineGroups.map((item) => [item._id, item.count]));
  return {
    mobile: Number(onlineByDevice.mobile || 0),
    desktop: Number(onlineByDevice.desktop || 0),
  };
};

const updateRedisPresence = async (sessionId, deviceType, now) => {
  if (!isRedisReady()) return null;
  try {
    const markerKey = `traffic:session:${sessionId}`;
    const markerExists = await clientRedis.exists(markerKey);
    const otherDevice = deviceType === "mobile" ? "desktop" : "mobile";
    const commands = clientRedis.multi();
    commands.set(markerKey, "1", { EX: sessionCacheSeconds });
    commands.zAdd(onlineKeys[deviceType], [{ score: now.getTime(), value: sessionId }]);
    commands.zRem(onlineKeys[otherDevice], sessionId);
    commands.zRemRangeByScore(onlineKeys.mobile, 0, now.getTime() - onlineWindowMs);
    commands.zRemRangeByScore(onlineKeys.desktop, 0, now.getTime() - onlineWindowMs);
    await commands.exec();
    return { markerExists: markerExists > 0 };
  } catch {
    return null;
  }
};

const getTrafficStats = async () => {
  const [traffic, onlineByDevice] = await Promise.all([
    TrafficStat.findOneAndUpdate(
      { key: "global" },
      { $setOnInsert: { key: "global", mobileVisits: 0, desktopVisits: 0 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean(),
    readOnlineCounts(),
  ]);

  const mobileVisits = Number(traffic?.mobileVisits || 0);
  const desktopVisits = Number(traffic?.desktopVisits || 0);
  const mobileOnline = Number(onlineByDevice.mobile || 0);
  const desktopOnline = Number(onlineByDevice.desktop || 0);

  return {
    visits: {
      total: mobileVisits + desktopVisits,
      mobile: mobileVisits,
      desktop: desktopVisits,
    },
    online: {
      total: mobileOnline + desktopOnline,
      mobile: mobileOnline,
      desktop: desktopOnline,
    },
  };
};

export const recordTrafficHeartbeat = async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "").trim();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) {
      return res.status(400).json({ success: false, error: "Phiên truy cập không hợp lệ" });
    }

    const now = new Date();
    const deviceType = normalizeDeviceType(req.body?.deviceType, req.headers["user-agent"]);
    const redisPresence = await updateRedisPresence(sessionId, deviceType, now);
    let result = { upsertedCount: 0 };
    if (!redisPresence?.markerExists) {
      const update = redisPresence
        ? { $setOnInsert: { userId: req.user._id, deviceType, firstSeen: now, lastSeen: now } }
        : {
          $set: { userId: req.user._id, deviceType, lastSeen: now },
          $setOnInsert: { firstSeen: now },
        };
      result = await PresenceSession.updateOne({ sessionId }, update, { upsert: true });
    }

    if (result.upsertedCount > 0) {
      await TrafficStat.findOneAndUpdate(
        { key: "global" },
        {
          $inc: { [deviceType === "mobile" ? "mobileVisits" : "desktopVisits"]: 1 },
          $set: { updatedAt: now },
        },
        { upsert: true, setDefaultsOnInsert: false }
      );
    }

    return res.json({ success: true, stats: await getTrafficStats() });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không cập nhật được thống kê truy cập" });
  }
};

export const readTrafficStats = async (req, res) => {
  try {
    return res.json({ success: true, stats: await getTrafficStats() });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không tải được thống kê truy cập" });
  }
};
