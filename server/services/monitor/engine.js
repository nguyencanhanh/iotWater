import os from "os";
import Info from "../../models/Info.js";
import MonitorEvent from "../../models/MonitorEvent.js";
import MonitorState from "../../models/MonitorState.js";
import Sensor from "../../models/Sensor.js";
import { loadHourly } from "../agent/anomaly.js";
import { TZ, formatVnTime, getKindLabel } from "./common.js";
import { notifyEventClosed, notifyEventOpened, sendTelegram } from "./notify.js";

// Giam sat 24/7: moi 15 phut so so do moi nhat cua tung logger voi MUC BINH THUONG
// CUNG KHUNG GIO (trung vi 28 ngay). Cung cong thuc voi phan tich bat thuong cua tro ly
// (services/agent/anomaly.js) de hai noi khong bao khac nhau.

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const BASELINE_DAYS = 28;
const BASELINE_TTL_MS = 6 * HOUR;
const WINDOW_MS = 15 * MINUTE;
const MIN_PROFILE_DAYS = 5;
// Logger co du lieu duoi 20% so gio trong 28 ngay (du phong, chua lap) thi bo qua.
const MIN_COVERAGE = 0.2;
const CLOSE_AFTER_NORMAL = 2;
const LOCK_MS = 10 * MINUTE;
const OWNER = `${os.hostname()}:${process.pid}:${process.env.PORT || ""}`;

export const STATE_KEY = "global";

const round = (value, digits = 1) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const vnHour = (date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(date));

/* ------------------------------ Muc binh thuong ------------------------------ */

const baselineCache = new Map(); // user -> { at, byId: Map(id -> baseline) }

const buildBaseline = (rows, adjust) => {
  const byHour = Array.from({ length: 24 }, () => []);
  rows.forEach((row) => {
    byHour[vnHour(row._id.hour)].push({
      avgP: Number(row.avgP) + adjust,
      minP: Number(row.minP) + adjust,
      maxP: Number(row.maxP) + adjust,
      avgF: Number(row.avgF),
    });
  });
  const hasFlow = rows.some((row) => Number(row.maxF) > 0);
  return {
    coverage: rows.length / (BASELINE_DAYS * 24),
    hasFlow,
    profile: byHour.map((items) => ({
      days: items.length,
      avgP: median(items.map((item) => item.avgP)),
      minP: median(items.map((item) => item.minP)),
      maxP: median(items.map((item) => item.maxP)),
      avgF: median(items.map((item) => item.avgF)),
    })),
  };
};

// "now" cho phep chay lai lich su (test): muc binh thuong chi dung du lieu TRUOC thoi diem do.
export const getBaselines = async (user, loggers, { force = false, now = new Date() } = {}) => {
  const cached = baselineCache.get(user);
  const age = now.getTime() - (cached?.at ?? 0);
  if (!force && cached && age >= 0 && age < BASELINE_TTL_MS) return cached.byId;

  const end = now;
  const start = new Date(end.getTime() - BASELINE_DAYS * 24 * HOUR);
  const byId = new Map();
  // Chia nho de moi aggregate khong qua nang.
  for (let index = 0; index < loggers.length; index += 8) {
    const chunk = loggers.slice(index, index + 8);
    const rows = await loadHourly({ user, ids: chunk.map((item) => Number(item.id)), start, end });
    chunk.forEach((logger) => {
      const own = rows.filter((row) => Number(row._id.index) === Number(logger.id));
      byId.set(Number(logger.id), buildBaseline(own, Number(logger.adj || 0)));
    });
  }
  baselineCache.set(user, { at: now.getTime(), byId });
  return byId;
};

/* ------------------------------ Danh gia 1 logger ------------------------------ */

const summarizeWindow = (docs, adjust) => {
  const pressures = docs.map((doc) => Number(doc.Pressure) + adjust).filter(Number.isFinite);
  const flows = docs.map((doc) => Number(doc.flow)).filter(Number.isFinite);
  const minIndex = pressures.length ? pressures.indexOf(Math.min(...pressures)) : -1;
  const maxIndex = pressures.length ? pressures.indexOf(Math.max(...pressures)) : -1;
  return {
    count: docs.length,
    minP: pressures.length ? Math.min(...pressures) : null,
    minAt: minIndex >= 0 ? docs[minIndex].createAt : null,
    maxP: pressures.length ? Math.max(...pressures) : null,
    maxAt: maxIndex >= 0 ? docs[maxIndex].createAt : null,
    maxF: flows.length ? Math.max(...flows) : null,
  };
};

// Tra ve danh sach "tinh trang dang xay ra" cua logger o luot nay.
export const evaluateLogger = ({ logger, baseline, lastAt, recent, now = new Date() }) => {
  const conditions = [];
  const intervalMs = Math.max(Number(logger.interval || 60) * 2 * 1000, 15 * MINUTE);

  if (!lastAt || now.getTime() - new Date(lastAt).getTime() > intervalMs) {
    const since = lastAt ? new Date(lastAt) : null;
    const hours = since ? (now.getTime() - since.getTime()) / HOUR : null;
    conditions.push({
      kind: "offline",
      level: hours === null || hours >= 6 ? "cao" : "trung bình",
      startAt: since || now,
      value: round(hours, 1),
      unit: "giờ",
      message: since
        ? `Mất tín hiệu từ ${formatVnTime(since, true)} (${round(hours, 1)} giờ)`
        : "Không có dữ liệu",
    });
    return conditions;
  }

  // Hai cua so 15 phut lien tiep tinh tu ban ghi moi nhat (logger day 30 phut/lan van dung duoc).
  const end = new Date(lastAt).getTime();
  const adjust = Number(logger.adj || 0);
  const newer = summarizeWindow(recent.filter((doc) => new Date(doc.createAt).getTime() > end - WINDOW_MS), adjust);
  const older = summarizeWindow(recent.filter((doc) => {
    const time = new Date(doc.createAt).getTime();
    return time <= end - WINDOW_MS && time > end - 2 * WINDOW_MS;
  }), adjust);
  if (newer.count < 2 || older.count < 2) return conditions;

  const profile = baseline.profile[vnHour(new Date(end))];
  if (!profile || profile.days < MIN_PROFILE_DAYS || !Number.isFinite(profile.avgP)) return conditions;
  const band = Math.max(profile.avgP * 0.3, 3);

  // Phai lech o CA HAI cua so moi tinh, tranh mot gia tri nhieu le.
  if (newer.minP < profile.minP - band && older.minP < profile.minP - band) {
    const worst = Math.min(newer.minP, older.minP);
    conditions.push({
      kind: "pressure_drop",
      level: worst < 2 || worst < profile.minP * 0.3 ? "cao" : "trung bình",
      startAt: new Date(end - 2 * WINDOW_MS),
      value: round(worst),
      expected: round(profile.minP),
      unit: "m",
      at: worst === newer.minP ? newer.minAt : older.minAt,
    });
  }
  if (newer.maxP > profile.maxP + band && older.maxP > profile.maxP + band) {
    const worst = Math.max(newer.maxP, older.maxP);
    conditions.push({
      kind: "pressure_surge",
      level: worst > profile.maxP + 2 * band ? "cao" : "trung bình",
      startAt: new Date(end - 2 * WINDOW_MS),
      value: round(worst),
      expected: round(profile.maxP),
      unit: "m",
      at: worst === newer.maxP ? newer.maxAt : older.maxAt,
    });
  }

  const hour = vnHour(new Date(end));
  if (baseline.hasFlow && hour >= 6 && hour <= 21 && profile.avgF > 1 && newer.maxF <= 0 && older.maxF <= 0) {
    conditions.push({
      kind: "flow_zero",
      level: "cao",
      startAt: new Date(end - 2 * WINDOW_MS),
      value: 0,
      expected: round(profile.avgF),
      unit: "m³/h",
    });
  }
  return conditions;
};

const describe = (event) => {
  const text = describeBase(event);
  return event.recurring ? `${text} — lặp lại ${event.recurring}/${RECUR_DAYS} ngày gần đây cùng khung giờ, có thể do lịch vận hành mới` : text;
};

const describeBase = (event) => {
  if (event.kind === "offline") return event.message;
  if (event.kind === "flow_zero") {
    return `Lưu lượng = 0 từ ${formatVnTime(event.startAt)} trong khi thường ~${event.expected} m³/h cùng khung giờ`;
  }
  const verb = event.kind === "pressure_drop" ? "còn" : "lên";
  return `${getKindLabel(event.kind)}: ${verb} ${event.value} m${event.at ? ` lúc ${formatVnTime(event.at)}` : ""}, thường ~${event.expected} m cùng khung giờ`;
};

/* ------------------------------ Vong doi su kien ------------------------------ */

const LEVEL_RANK = { "thấp": 0, "trung bình": 1, cao: 2 };
const RECUR_DAYS = 3;
const RECUR_WINDOW_MS = 90 * MINUTE;

// Dem so ngay (trong RECUR_DAYS ngay qua) ma cung gio nay, logger dang co su kien cung loai.
// So theo CA KHOANG dien ra (bat dau -> ket thuc), khong chi gio bat dau: su kien bi ngat
// giua chung (vd mat du lieu) roi mo lai van duoc nhan ra la lap lai.
const countRecurring = async ({ user, sensorId, kind, at, now }) => {
  const since = new Date(now.getTime() - (RECUR_DAYS + 1) * 24 * HOUR);
  const past = await MonitorEvent.find({ user, sensorId, kind, startAt: { $gte: since, $lt: new Date(now.getTime() - 12 * HOUR) } })
    .select("startAt endAt lastSeenAt")
    .lean();
  const target = new Date(at).getTime();
  let days = 0;
  for (let day = 1; day <= RECUR_DAYS; day += 1) {
    const sameTime = target - day * 24 * HOUR;
    const hit = past.some((event) => {
      const start = new Date(event.startAt).getTime() - RECUR_WINDOW_MS;
      const end = new Date(event.endAt || event.lastSeenAt || event.startAt).getTime() + RECUR_WINDOW_MS;
      return sameTime >= start && sameTime <= end;
    });
    if (hit) days += 1;
  }
  return days;
};

const applyConditions = async ({ user, logger, conditions, now, notify, notifyOffline, counters }) => {
  const open = await MonitorEvent.find({
    user,
    sensorId: Number(logger.id),
    status: "open",
    kind: { $in: ["pressure_drop", "pressure_surge", "flow_zero", "offline"] },
  });
  const openByKind = new Map(open.map((event) => [event.kind, event]));

  for (const condition of conditions) {
    const existing = openByKind.get(condition.kind);
    if (!existing) {
      // Cung hien tuong, cung khung gio, lap lai >= 2 trong 3 ngay qua -> nhieu kha nang la lich
      // van hanh moi (muc binh thuong 28 ngay chua kip hoc). Ha muc, khong nhan Telegram hang ngay.
      const recurring = condition.kind === "offline" ? 0 : await countRecurring({ user, sensorId: Number(logger.id), kind: condition.kind, at: condition.startAt, now });
      if (recurring >= 2) {
        condition.level = "thấp";
        condition.recurring = recurring;
      }
      const event = await MonitorEvent.create({
        user,
        sensorId: Number(logger.id),
        sensorName: logger.name || `Logger ${logger.id}`,
        group: logger.group || "",
        kind: condition.kind,
        level: condition.level,
        startAt: condition.startAt,
        lastSeenAt: now,
        value: condition.value,
        expected: condition.expected ?? null,
        unit: condition.unit || "",
        message: describe(condition),
        mode: logger.monitorMode || "on",
        recurring: condition.recurring || 0,
      });
      counters.opened += 1;
      if (notify && event.mode === "on" && event.level === "cao" && (event.kind !== "offline" || notifyOffline)) {
        await notifyEventOpened(event);
      }
      continue;
    }

    existing.lastSeenAt = now;
    existing.normalStreak = 0;
    const worse = condition.kind === "pressure_drop"
      ? condition.value < existing.value
      : condition.kind === "offline" || condition.value > existing.value;
    if (worse) {
      existing.value = condition.value;
      existing.message = describe({ ...condition, startAt: existing.startAt, recurring: existing.recurring });
    }
    const escalated = !existing.recurring && LEVEL_RANK[condition.level] > LEVEL_RANK[existing.level];
    if (escalated) existing.level = condition.level;
    await existing.save();
    counters.updated += 1;
    if (notify && escalated && existing.mode === "on" && existing.level === "cao" && existing.notifiedLevel !== "cao"
      && (existing.kind !== "offline" || notifyOffline)) {
      await notifyEventOpened(existing);
    }
  }

  const activeKinds = new Set(conditions.map((condition) => condition.kind));
  // Dang mat tin hieu thi khong biet ap/luu luong ra sao -> giu nguyen cac su kien khac.
  const blind = activeKinds.has("offline");
  for (const event of open) {
    if (activeKinds.has(event.kind)) continue;
    if (blind && event.kind !== "offline") continue;
    // Mat tin hieu thi co du lieu tro lai la dong ngay; con lai phai binh thuong 2 luot lien tiep.
    event.normalStreak += 1;
    if (event.kind === "offline" || event.normalStreak >= CLOSE_AFTER_NORMAL) {
      event.status = "closed";
      event.endAt = event.kind === "offline" ? now : event.lastSeenAt;
      counters.closed += 1;
      if (event.notifiedAt) await notifyEventClosed(event);
    }
    await event.save();
  }
};

/* ------------------------------ Mat du lieu dien rong ------------------------------ */

const WIDESPREAD_MIN = 5;
const WIDESPREAD_RATIO = 0.5;

const updateWidespread = async ({ state, widespread, offline, total, now }) => {
  if (widespread) {
    const since = state.widespreadSince
      || new Date(Math.min(...offline.map((item) => new Date(item.lastAt || now).getTime())));
    const update = { widespreadSince: since, widespreadCount: offline.length };
    if (state.notify && !state.widespreadNotified) {
      const sent = await sendTelegram([
        "⚠️ GIÁM SÁT AI — MẤT DỮ LIỆU DIỆN RỘNG",
        `${offline.length}/${total} logger không gửi dữ liệu từ khoảng ${formatVnTime(since, true)}.`,
        "Nhiều khả năng do máy chủ, MQTT hoặc đường mạng, không phải sự cố tại từng điểm. Sẽ không nhắn riêng từng logger.",
      ].join("\n"));
      update.widespreadNotified = sent;
    }
    await MonitorState.updateOne({ key: STATE_KEY }, { $set: update });
    state.widespreadNotified = update.widespreadNotified ?? state.widespreadNotified;
    return;
  }
  if (state.widespreadSince) {
    if (state.widespreadNotified) {
      await sendTelegram(`✅ Dữ liệu đã trở lại: ${total - offline.length}/${total} logger gửi dữ liệu bình thường (mất từ ${formatVnTime(state.widespreadSince, true)}).`);
    }
    await MonitorState.updateOne({ key: STATE_KEY }, { $set: { widespreadSince: null, widespreadCount: 0, widespreadNotified: false } });
  }
};

/* ------------------------------ Khoa + luot chay ------------------------------ */

export const getState = async () => MonitorState.findOneAndUpdate(
  { key: STATE_KEY },
  { $setOnInsert: { key: STATE_KEY, notify: process.env.MONITOR_NOTIFY === "1" } },
  { new: true, upsert: true }
).lean();

export const withLock = async (fn) => {
  await getState();
  const now = new Date();
  const locked = await MonitorState.findOneAndUpdate(
    { key: STATE_KEY, $or: [{ lockUntil: null }, { lockUntil: { $lt: now } }] },
    { $set: { lockUntil: new Date(now.getTime() + LOCK_MS), lockOwner: OWNER } },
    { new: true }
  ).lean();
  if (!locked) return { skipped: true };
  try {
    return await fn(locked);
  } finally {
    await MonitorState.updateOne({ key: STATE_KEY, lockOwner: OWNER }, { $set: { lockUntil: null } });
  }
};

export const listMonitoredLoggers = async (user) => Info.find({ user })
  .select("id name group interval adj monitorMode")
  .sort({ sortOrder: 1, createAt: -1 })
  .lean();

export const listUsers = async () => (await Info.distinct("user")).filter((user) => Number.isFinite(Number(user)));

export const runCheck = async ({ now = new Date() } = {}) => withLock(async (state) => {
  const started = Date.now();
  // "noData" (khong phai "skipped"): "skipped" la dau hieu luot bi bo qua do khoa trong withLock.
  const counters = { loggers: 0, noData: 0, opened: 0, updated: 0, closed: 0 };
  try {
    for (const user of await listUsers()) {
      const loggers = (await listMonitoredLoggers(user)).filter((logger) => (logger.monitorMode || "on") !== "off");
      const baselines = await getBaselines(user, loggers, { now });

      // Luot 1: danh gia tat ca logger. Luot 2: ap dung - de biet truoc co mat du lieu dien rong khong.
      const evaluations = [];
      for (const logger of loggers) {
        const baseline = baselines.get(Number(logger.id));
        if (!baseline || baseline.coverage < MIN_COVERAGE) {
          counters.noData += 1;
          continue;
        }
        counters.loggers += 1;
        const last = await Sensor.findOne({ user, index: Number(logger.id), createAt: { $lte: now } })
          .sort({ createAt: -1 })
          .select("createAt")
          .lean();
        const lastAt = last?.createAt || null;
        const recent = lastAt
          ? await Sensor.find({
            user,
            index: Number(logger.id),
            createAt: { $gt: new Date(new Date(lastAt).getTime() - 2 * WINDOW_MS), $lte: lastAt },
          }).select("Pressure flow createAt").lean()
          : [];
        evaluations.push({ logger, lastAt, conditions: evaluateLogger({ logger, baseline, lastAt, recent, now }) });
      }

      const offline = evaluations.filter((item) => item.conditions.some((condition) => condition.kind === "offline"));
      const widespread = offline.length >= WIDESPREAD_MIN && offline.length >= evaluations.length * WIDESPREAD_RATIO;
      counters.offline = offline.length;
      counters.widespread = widespread;
      await updateWidespread({ state, widespread, offline, total: evaluations.length, now });

      for (const { logger, conditions } of evaluations) {
        await applyConditions({ user, logger, conditions, now, notify: state.notify, notifyOffline: !widespread, counters });
      }
    }
    await MonitorState.updateOne({ key: STATE_KEY }, {
      $set: { lastRunAt: now, lastRunMs: Date.now() - started, lastRunSummary: counters, lastError: "" },
    });
    return counters;
  } catch (error) {
    await MonitorState.updateOne({ key: STATE_KEY }, { $set: { lastRunAt: now, lastError: error.message } });
    throw error;
  }
});
