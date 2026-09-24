import MonitorEvent from "../../models/MonitorEvent.js";
import MonitorReport from "../../models/MonitorReport.js";
import MonitorState from "../../models/MonitorState.js";
import { buildAnomalyData } from "../agent/anomaly.js";
import { chatComplete } from "../ai/index.js";
import { formatVnTime, getKindLabel } from "./common.js";
import { STATE_KEY, getBaselines, listMonitoredLoggers, listUsers, withLock } from "./engine.js";
import { notifyEventOpened, sendTelegram } from "./notify.js";

const DAY = 86400000;
const MNF_DAYS = 14;

/* ------------------------------ Luu luong dem (5h30) ------------------------------ */

// Lay ket qua cua bo phan tich bat thuong 14 ngay, chi giu 2 dau hieu ro ri nen.
const MNF_RULES = [
  { kind: "mnf_rise", test: (finding) => finding.level === "cao" && /^Lưu lượng đêm tối thiểu \(1h–5h\) tăng dần/.test(finding.text) },
  { kind: "mnf_high", test: (finding) => finding.level === "cao" && /^Lưu lượng đêm tối thiểu cao/.test(finding.text) },
];

export const runNightFlowCheck = async ({ now = new Date() } = {}) => withLock(async (state) => {
  const counters = { loggers: 0, opened: 0, updated: 0, closed: 0 };
  for (const user of await listUsers()) {
    const loggers = (await listMonitoredLoggers(user)).filter((logger) => (logger.monitorMode || "on") !== "off");
    const baselines = await getBaselines(user, loggers, { now });
    const flowLoggers = loggers.filter((logger) => baselines.get(Number(logger.id))?.hasFlow);
    const detected = new Set();

    for (let index = 0; index < flowLoggers.length; index += 10) {
      const chunk = flowLoggers.slice(index, index + 10);
      const data = await buildAnomalyData({
        user,
        sensors: chunk,
        fromDate: new Date(now.getTime() - MNF_DAYS * DAY).toISOString(),
        toDate: now.toISOString(),
        groupLabel: "giám sát",
      });

      for (const result of data.results) {
        counters.loggers += 1;
        const logger = chunk.find((item) => Number(item.id) === result.summary.id);
        for (const rule of MNF_RULES) {
          const finding = result.findings.find(rule.test);
          if (!finding) continue;
          detected.add(`${result.summary.id}:${rule.kind}`);
          const open = await MonitorEvent.findOne({ user, sensorId: result.summary.id, kind: rule.kind, status: "open" });
          if (open) {
            open.lastSeenAt = now;
            open.message = finding.text;
            await open.save();
            counters.updated += 1;
            continue;
          }
          const event = await MonitorEvent.create({
            user,
            sensorId: result.summary.id,
            sensorName: result.summary.name,
            group: result.summary.group,
            kind: rule.kind,
            level: "cao",
            startAt: now,
            lastSeenAt: now,
            value: result.summary.flow?.mnfMedian ?? null,
            unit: "m³/h",
            message: finding.text,
            mode: logger?.monitorMode || "on",
          });
          counters.opened += 1;
          if (state.notify && event.mode === "on") await notifyEventOpened(event);
        }
      }
    }

    // Hom nay khong con dau hieu thi dong su kien luu luong dem.
    const openNight = await MonitorEvent.find({ user, status: "open", kind: { $in: ["mnf_rise", "mnf_high"] } });
    for (const event of openNight) {
      if (detected.has(`${event.sensorId}:${event.kind}`)) continue;
      event.status = "closed";
      event.endAt = now;
      await event.save();
      counters.closed += 1;
    }
  }
  await MonitorState.updateOne({ key: STATE_KEY }, { $set: { lastMnfAt: now } });
  return counters;
});

/* ------------------------------ Bao cao 24h (7h sang) ------------------------------ */

const REPORT_SYSTEM = "Bạn là trưởng ca vận hành mạng cấp nước. Viết báo cáo giao ca ngắn gọn bằng tiếng Việt từ danh sách sự kiện do hệ thống giám sát tự động phát hiện. Chỉ trả về Markdown thuần, không code fence, không LaTeX. Không bịa số liệu, thời điểm hay logger không có trong dữ liệu.";

const compactEvent = (event) => ({
  logger: `${event.sensorName} (${event.sensorId})`,
  nhom: event.group || "",
  loai: getKindLabel(event.kind),
  muc: event.level,
  trangThai: event.status === "open" ? "đang diễn ra" : `đã hết lúc ${formatVnTime(event.endAt, true)}`,
  batDau: formatVnTime(event.startAt, true),
  chiTiet: event.message,
  danhGia: event.feedback === "confirmed" ? "người vận hành xác nhận đúng" : event.feedback === "false_alarm" ? "người vận hành đánh dấu báo nhầm" : "",
  cheDo: event.mode === "report" ? "logger chỉ ghi báo cáo" : "",
});

// Viec nen lam theo tung loai hien tuong (bao cao local, khong can AI).
const ACTION_HINTS = {
  pressure_drop: "kiểm tra vỡ ống / van bị đóng quanh logger",
  pressure_surge: "kiểm tra van điều áp, thao tác đóng mở van",
  flow_zero: "kiểm tra van tổng, cắt nước hoặc đồng hồ lưu lượng",
  offline: "kiểm tra nguồn, sóng và logger",
  mnf_rise: "khoanh vùng dò rò rỉ ban đêm (1h–5h)",
  mnf_high: "dò rò rỉ nền, rà soát hộ dùng nước ban đêm",
};

const eventLine = (event, withHint = false) => {
  const label = getKindLabel(event.kind);
  // Tin cua tut/tang ap va luu luong dem da tu mo ta hien tuong, khong can ghep ten loai.
  const selfDescribed = event.message.startsWith(label) || event.kind.startsWith("mnf_");
  const detail = selfDescribed ? event.message : `${label}: ${event.message}`;
  const state = event.status === "open" ? "đang diễn ra" : `đã hết ${formatVnTime(event.endAt, true)}`;
  const hint = withHint && ACTION_HINTS[event.kind] ? ` → ${ACTION_HINTS[event.kind]}` : "";
  return `- **${event.sensorName} (${event.sensorId})** — ${detail} (${state})${hint}`;
};

// Bao cao tu tao hoan toan tren may chu tu cac su kien da phat hien. Mac dinh dung ban nay;
// Gemini chi viet lai loi van khi bat cong tac aiReport.
const localSummary = (events, periodText, stats) => {
  if (!events.length) return `# BÁO CÁO GIÁM SÁT 24 GIỜ\n\n${periodText}: không phát hiện bất thường nào, mạng lưới vận hành ổn định.`;
  const falseAlarm = (event) => event.feedback === "false_alarm";
  const urgent = events.filter((event) => event.level === "cao" && !falseAlarm(event) && event.kind !== "offline");
  const watch = events.filter((event) => event.level === "trung bình" && !falseAlarm(event) && event.kind !== "offline");
  const recurring = events.filter((event) => event.level === "thấp" && !falseAlarm(event));
  const offline = events.filter((event) => event.kind === "offline" && !falseAlarm(event));
  const dismissed = events.filter(falseAlarm);

  const sections = [
    "# BÁO CÁO GIÁM SÁT 24 GIỜ",
    periodText,
    "## Tóm tắt",
    `- ${stats.total} sự kiện ở ${stats.loggers} logger: ${urgent.length} cần xử lý ngay, ${watch.length} cần theo dõi, ${recurring.length} lặp lại hằng ngày.`,
    `- ${stats.open} sự kiện vẫn đang diễn ra lúc lập báo cáo.`,
  ];
  if (urgent.length) sections.push("## Cần xử lý ngay", ...urgent.map((event) => eventLine(event, true)));
  if (watch.length) sections.push("## Theo dõi thêm", ...watch.slice(0, 30).map((event) => eventLine(event)));
  if (recurring.length) {
    // Gom theo logger: cung mot hien tuong lap lai nhieu lan chi can 1 dong.
    const byLogger = new Map();
    recurring.forEach((event) => {
      const key = `${event.sensorName} (${event.sensorId})`;
      byLogger.set(key, [...(byLogger.get(key) || []), getKindLabel(event.kind)]);
    });
    sections.push(
      "## Lặp lại hằng ngày (có thể do lịch vận hành)",
      ...[...byLogger].map(([logger, kinds]) => `- **${logger}** — ${[...new Set(kinds)].join(", ")} (${kinds.length} lần)`)
    );
  }
  if (offline.length || dismissed.length) {
    sections.push("## Ghi chú");
    if (offline.length) sections.push(`- Mất tín hiệu: ${offline.map((event) => `${event.sensorName} (${event.sensorId})`).join(", ")}.`);
    if (dismissed.length) sections.push(`- ${dismissed.length} sự kiện đã được người vận hành đánh dấu báo nhầm.`);
  }
  return sections.join("\n\n").replace(/\n\n- /g, "\n- ");
};

const toPlainText = (markdown) => markdown
  .replace(/^#+\s*/gm, "")
  .replace(/\*\*(.+?)\*\*/g, "$1")
  .replace(/^\s*[-*]\s+/gm, "• ");

export const buildDailyReport = async ({ user, now = new Date(), send = true } = {}) => {
  const periodFrom = new Date(now.getTime() - DAY);
  const events = await MonitorEvent.find({
    user,
    $or: [
      { startAt: { $gte: periodFrom, $lte: now } },
      { status: "open" },
      { endAt: { $gte: periodFrom, $lte: now } },
    ],
  }).sort({ level: 1, startAt: -1 }).limit(200).lean();

  const stats = {
    total: events.length,
    open: events.filter((event) => event.status === "open").length,
    high: events.filter((event) => event.level === "cao").length,
    falseAlarms: events.filter((event) => event.feedback === "false_alarm").length,
    byKind: events.reduce((result, event) => ({ ...result, [event.kind]: (result[event.kind] || 0) + 1 }), {}),
    loggers: new Set(events.map((event) => event.sensorId)).size,
  };
  const periodText = `Từ ${formatVnTime(periodFrom, true)} đến ${formatVnTime(now, true)}`;

  let summary = "";
  let provider = "";
  let aiError = "";
  const state = await MonitorState.findOne({ key: STATE_KEY }).lean();
  if (events.length && state?.aiReport) {
    try {
      // gemini-web2api doi khi tu choi ("Toi khong the giup...") -> kiem tra dung khung,
      // sai thi thu lai 1 lan, van sai thi dung ban tu dong ben duoi.
      const request = () => chatComplete({
        messages: [
          { role: "system", content: REPORT_SYSTEM },
          {
            role: "user",
            content: `${periodText}. Có ${stats.total} sự kiện (${stats.high} mức cao, ${stats.open} đang diễn ra).

TRẢ VỀ ĐÚNG KHUNG:
# BÁO CÁO GIÁM SÁT 24 GIỜ
## Tóm tắt
(2–3 gạch đầu dòng)
## Cần xử lý ngay
(sự kiện mức cao đang diễn ra hoặc chưa ai xác nhận; mỗi dòng: logger, hiện tượng, thời điểm, đề xuất việc làm cụ thể)
## Theo dõi thêm
## Ghi chú
(logger mất tín hiệu, sự kiện bị đánh dấu báo nhầm; bỏ mục này nếu không có)

SỰ KIỆN:
${JSON.stringify(events.map(compactEvent), null, 1)}`,
          },
        ],
        temperature: 0.2,
        longForm: true,
      });
      for (let attempt = 1; attempt <= 2 && !summary; attempt += 1) {
        const result = await request();
        const text = String(result.content || "").replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        const headingIndex = text.search(/#\s*BÁO CÁO GIÁM SÁT/i);
        if (headingIndex >= 0) {
          summary = text.slice(headingIndex).trim();
          provider = result.provider || "";
        } else {
          aiError = `AI trả lời sai khung: ${text.slice(0, 120)}`;
        }
      }
      if (summary) aiError = "";
    } catch (error) {
      aiError = error.message;
    }
  }
  if (!summary) {
    summary = localSummary(events, periodText, stats);
    provider = "local";
  }

  const report = await MonitorReport.create({ user, periodFrom, periodTo: now, stats, summary, provider, aiError });
  if (send && state?.notify) {
    const sent = await sendTelegram(`📋 ${toPlainText(summary)}`);
    if (sent) await MonitorReport.updateOne({ _id: report._id }, { $set: { sentAt: new Date() } });
  }
  return report;
};

export const runDailyReports = async ({ now = new Date() } = {}) => withLock(async () => {
  const reports = [];
  for (const user of await listUsers()) reports.push(await buildDailyReport({ user, now }));
  await MonitorState.updateOne({ key: STATE_KEY }, { $set: { lastReportAt: now } });
  return reports.length;
});
