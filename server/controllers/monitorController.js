import Info from "../models/Info.js";
import MonitorEvent from "../models/MonitorEvent.js";
import MonitorReport from "../models/MonitorReport.js";
import MonitorState from "../models/MonitorState.js";
import { formatVnTime, getKindLabel } from "../services/monitor/common.js";
import { buildDailyReport } from "../services/monitor/daily.js";
import { STATE_KEY, getBaselines, getState, listMonitoredLoggers, runCheck } from "../services/monitor/engine.js";
import { sendTelegram } from "../services/monitor/notify.js";

const getUserNumber = (req, source) => {
  const raw = Number(source?.user);
  return Number.isFinite(raw) ? raw : Number(req.user?.user ?? 0);
};
const isAdmin = (req) => req.user?.role === "admin";
const LEVEL_ORDER = { cao: 0, "trung bình": 1, "thấp": 2 };

const toClientEvent = (event) => ({ ...event, kindLabel: getKindLabel(event.kind) });

const publicState = (state) => ({
  enabled: process.env.MONITOR_ENABLED === "1",
  active: state?.active !== false,
  notify: Boolean(state?.notify),
  ticker: state?.ticker !== false,
  aiReport: Boolean(state?.aiReport),
  telegramConfigured: Boolean(process.env.TOKEN && process.env.TELEGRAM_CHAT_ID),
  lastRunAt: state?.lastRunAt || null,
  lastRunMs: state?.lastRunMs || 0,
  lastRunSummary: state?.lastRunSummary || {},
  lastError: state?.lastError || "",
  lastMnfAt: state?.lastMnfAt || null,
  lastReportAt: state?.lastReportAt || null,
  widespreadSince: state?.widespreadSince || null,
  widespreadCount: state?.widespreadCount || 0,
});

const handle = (fn) => async (req, res) => {
  try {
    return await fn(req, res);
  } catch (error) {
    console.error("[monitor] API lỗi:", error.message);
    return res.status(500).json({ success: false, error: error.message || "Lỗi giám sát" });
  }
};

export const getOverview = handle(async (req, res) => {
  const user = getUserNumber(req, req.query);
  const since = new Date(Date.now() - 86400000);
  const [state, open, last24h] = await Promise.all([
    getState(),
    MonitorEvent.find({ user, status: "open" }).sort({ startAt: -1 }).limit(200).lean(),
    MonitorEvent.countDocuments({ user, startAt: { $gte: since } }),
  ]);
  open.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || new Date(b.startAt) - new Date(a.startAt));
  return res.json({
    success: true,
    state: publicState(state),
    counts: {
      open: open.length,
      high: open.filter((event) => event.level === "cao").length,
      last24h,
    },
    open: open.map(toClientEvent),
  });
});

// Dong chu chay tren dau trang: chi su kien DANG dien ra, muc cao va trung binh.
export const getTicker = handle(async (req, res) => {
  const user = getUserNumber(req, req.query);
  const state = await getState();
  if (state?.ticker === false || state?.active === false || process.env.MONITOR_ENABLED !== "1") {
    return res.json({ success: true, enabled: false, items: [] });
  }
  const open = await MonitorEvent.find({ user, status: "open", level: { $in: ["cao", "trung bình"] }, feedback: { $ne: "false_alarm" } })
    .sort({ startAt: -1 })
    .limit(30)
    .lean();
  open.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  // Nhieu logger mat tin hieu cung luc thi gop thanh 1 dong, khong liet ke hang chuc dong.
  const offline = open.filter((event) => event.kind === "offline");
  const collapse = offline.length > 3;
  const items = open
    .filter((event) => !collapse || event.kind !== "offline")
    .map((event) => ({ id: event._id, level: event.level, text: `${event.sensorName} (${event.sensorId}) — ${event.message}` }));
  if (collapse) {
    const since = new Date(Math.min(...offline.map((event) => new Date(event.startAt).getTime())));
    items.unshift({
      id: `offline-${offline.length}`,
      level: state?.widespreadSince || offline.some((event) => event.level === "cao") ? "cao" : "trung bình",
      text: `${offline.length} logger mất tín hiệu từ ${formatVnTime(since, true)}${state?.widespreadSince ? " — mất dữ liệu diện rộng, kiểm tra máy chủ/MQTT/mạng" : ""}`,
    });
  }
  return res.json({ success: true, enabled: true, items });
});

export const listEvents = handle(async (req, res) => {
  const user = getUserNumber(req, req.query);
  const query = { user };
  if (["open", "closed"].includes(req.query.status)) query.status = req.query.status;
  if (["cao", "trung bình", "thấp"].includes(req.query.level)) query.level = req.query.level;
  if (req.query.kind) query.kind = String(req.query.kind);
  if (Number.isFinite(Number(req.query.sensorId)) && req.query.sensorId !== "") query.sensorId = Number(req.query.sensorId);
  if (req.query.feedback === "none") query.feedback = null;
  else if (["confirmed", "false_alarm"].includes(req.query.feedback)) query.feedback = req.query.feedback;
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  if (from || to) {
    query.startAt = {};
    if (from && !Number.isNaN(from.getTime())) query.startAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) query.startAt.$lte = to;
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const [events, total] = await Promise.all([
    MonitorEvent.find(query).sort({ startAt: -1 }).limit(limit).lean(),
    MonitorEvent.countDocuments(query),
  ]);
  return res.json({ success: true, total, events: events.map(toClientEvent) });
});

export const setFeedback = handle(async (req, res) => {
  if (req.user?.role === "trial") return res.status(403).json({ success: false, error: "Tài khoản dùng thử không đánh giá được" });
  const verdict = req.body?.verdict;
  if (![null, "confirmed", "false_alarm"].includes(verdict ?? null)) {
    return res.status(400).json({ success: false, error: "Đánh giá không hợp lệ" });
  }
  const user = getUserNumber(req, req.body);
  const event = await MonitorEvent.findOneAndUpdate(
    { _id: req.params.id, user },
    {
      $set: {
        feedback: verdict ?? null,
        feedbackNote: String(req.body?.note || "").slice(0, 500),
        feedbackBy: req.user?.name || req.user?.email || "",
        feedbackAt: verdict ? new Date() : null,
      },
    },
    { new: true }
  ).lean();
  if (!event) return res.status(404).json({ success: false, error: "Không tìm thấy sự kiện" });
  return res.json({ success: true, event: toClientEvent(event) });
});

export const listReports = handle(async (req, res) => {
  const user = getUserNumber(req, req.query);
  const reports = await MonitorReport.find({ user }).sort({ periodTo: -1 }).limit(30).lean();
  return res.json({ success: true, reports });
});

// AI viet bao cao co the mat vai phut (thu lai khi AI tu choi) - vuot gioi han 120s cua nginx.
// Nen chay nen va tra ve ngay; trang tu tai lai danh sach bao cao.
const reportJobs = new Set();

export const createReportNow = handle(async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Chỉ quản trị viên được tạo báo cáo" });
  const user = getUserNumber(req, req.body);
  if (reportJobs.has(user)) return res.status(202).json({ success: true, queued: true, running: true });
  reportJobs.add(user);
  buildDailyReport({ user, send: Boolean(req.body?.send) })
    .catch((error) => console.error("[monitor] tạo báo cáo lỗi:", error.message))
    .finally(() => reportJobs.delete(user));
  return res.status(202).json({ success: true, queued: true, startedAt: new Date() });
});

export const runNow = handle(async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Chỉ quản trị viên được chạy kiểm tra" });
  const state = await getState();
  if (state?.active === false) return res.status(409).json({ success: false, error: "Giám sát đang tắt, bật lại để kiểm tra" });
  const result = await runCheck();
  if (result?.skipped) return res.status(409).json({ success: false, error: "Đang có lượt kiểm tra khác chạy, thử lại sau ít phút" });
  return res.json({ success: true, result });
});

export const listLoggers = handle(async (req, res) => {
  const user = getUserNumber(req, req.query);
  const loggers = await listMonitoredLoggers(user);
  const [baselines, openCounts] = await Promise.all([
    getBaselines(user, loggers),
    MonitorEvent.aggregate([
      { $match: { user, status: "open" } },
      { $group: { _id: "$sensorId", count: { $sum: 1 } } },
    ]),
  ]);
  const openById = Object.fromEntries(openCounts.map((item) => [item._id, item.count]));
  return res.json({
    success: true,
    loggers: loggers.map((logger) => {
      const baseline = baselines.get(Number(logger.id));
      return {
        id: logger.id,
        name: logger.name || `Logger ${logger.id}`,
        group: logger.group || "Không có",
        mode: logger.monitorMode || "on",
        coverage: baseline ? Math.round(baseline.coverage * 1000) / 10 : 0,
        hasFlow: Boolean(baseline?.hasFlow),
        enoughData: Boolean(baseline && baseline.coverage >= 0.2),
        open: openById[logger.id] || 0,
      };
    }),
  });
});

export const updateLoggerMode = handle(async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Chỉ quản trị viên được đổi chế độ giám sát" });
  const mode = req.body?.mode;
  if (!["on", "report", "off"].includes(mode)) return res.status(400).json({ success: false, error: "Chế độ không hợp lệ" });
  const user = getUserNumber(req, req.body);
  const info = await Info.findOneAndUpdate({ user, id: Number(req.params.id) }, { $set: { monitorMode: mode } }, { new: true }).lean();
  if (!info) return res.status(404).json({ success: false, error: "Không tìm thấy logger" });
  // Tat giam sat thi dong luon cac su kien dang mo cua logger do.
  if (mode === "off") {
    await MonitorEvent.updateMany({ user, sensorId: Number(req.params.id), status: "open" }, { $set: { status: "closed", endAt: new Date() } });
  }
  return res.json({ success: true, id: info.id, mode: info.monitorMode });
});

export const updateSettings = handle(async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Chỉ quản trị viên được đổi cài đặt" });
  const update = { updatedBy: req.user?.name || req.user?.email || "" };
  if (typeof req.body?.notify === "boolean") update.notify = req.body.notify;
  if (typeof req.body?.ticker === "boolean") update.ticker = req.body.ticker;
  if (typeof req.body?.aiReport === "boolean") update.aiReport = req.body.aiReport;
  if (typeof req.body?.active === "boolean") update.active = req.body.active;
  await getState();
  const state = await MonitorState.findOneAndUpdate({ key: STATE_KEY }, { $set: update }, { new: true }).lean();
  return res.json({ success: true, state: publicState(state) });
});

export const testTelegram = handle(async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Chỉ quản trị viên được gửi thử" });
  const sent = await sendTelegram("✅ Giám sát AI: tin nhắn thử — kênh Telegram hoạt động.");
  return sent
    ? res.json({ success: true })
    : res.status(502).json({ success: false, error: "Không gửi được Telegram (kiểm tra TOKEN / TELEGRAM_CHAT_ID)" });
});
