import { chatCompleteJson } from "../ai/index.js";

export const REPORT_METRICS = {
  pressureFlow: { key: "pressureFlow", label: "Áp suất + Lưu lượng", unit: "" },
  pressure: { key: "pressure", label: "Áp suất", unit: "m" },
  flow: { key: "flow", label: "Lưu lượng", unit: "m³/h" },
  meter: { key: "meter", label: "Chỉ số đồng hồ", unit: "m³" },
};

export const ALLOWED_ACTIONS = new Set([
  "logger_report",
  "compare_loggers",
  "analyze_anomaly",
  "open_logger",
  "list_loggers",
  "system_overview",
  "list_incidents",
  "list_alerts",
  "dma_loss",
  "help",
  "refuse",
]);

export const INCIDENT_STATUSES = new Set(["open", "in_progress", "resolved", "all"]);

const MAX_COMPARE_LOGGERS = 5;

const DEFAULT_INTERVAL_MINUTES = 60;
const MAX_SENSOR_PROMPT_ITEMS = 160;
const TZ = "Asia/Ho_Chi_Minh";

export const normalizeText = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .replace(/Đ/g, "D")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const formatShortDate = (date) => new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(date);

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const parseDateToken = (token) => {
  const value = String(token || "").trim();
  let match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

// Hiểu cả ngày tuyệt đối lẫn các mốc tương đối hay dùng trong tiếng Việt.
export const extractDateRange = (message) => {
  const normalized = normalizeText(message);
  const today = new Date();

  const explicit = [...String(message || "").matchAll(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b/g)]
    .map((match) => parseDateToken(match[1]))
    .filter(Boolean);

  if (explicit.length) {
    const [from, to = explicit[0]] = explicit;
    return { fromDate: startOfDay(from).toISOString(), toDate: endOfDay(to).toISOString() };
  }

  // "1 thang vua qua", "2 tuan gan day": tinh lui tu hom nay, khong phai thang/tuan lich.
  const relativeUnits = normalized.match(/(\d{1,2})\s*(thang|tuan)\s*(?:vua\s*)?(?:qua|gan day|truoc|nay)/);
  if (relativeUnits) {
    const days = Math.min(Number(relativeUnits[1]) * (relativeUnits[2] === "thang" ? 30 : 7), 92);
    return { fromDate: startOfDay(addDays(today, -(days - 1))).toISOString(), toDate: endOfDay(today).toISOString() };
  }
  if (/(thang|tuan) vua qua/.test(normalized)) {
    const days = /thang vua qua/.test(normalized) ? 30 : 7;
    return { fromDate: startOfDay(addDays(today, -(days - 1))).toISOString(), toDate: endOfDay(today).toISOString() };
  }

  const relativeDays = normalized.match(/(\d{1,3})\s*(?:ngay|ngày)\s*(?:vua\s*)?(?:qua|gan day|gần đây|truoc|trước)/);
  if (relativeDays) {
    const days = Math.min(Math.max(Number(relativeDays[1]), 1), 92);
    return { fromDate: startOfDay(addDays(today, -(days - 1))).toISOString(), toDate: endOfDay(today).toISOString() };
  }

  if (/hom qua/.test(normalized)) {
    const yesterday = addDays(today, -1);
    return { fromDate: startOfDay(yesterday).toISOString(), toDate: endOfDay(yesterday).toISOString() };
  }
  if (/hom nay|hom nai/.test(normalized)) {
    return { fromDate: startOfDay(today).toISOString(), toDate: endOfDay(today).toISOString() };
  }
  if (/tuan nay/.test(normalized)) {
    const weekday = (today.getDay() + 6) % 7;
    return { fromDate: startOfDay(addDays(today, -weekday)).toISOString(), toDate: endOfDay(today).toISOString() };
  }
  if (/tuan truoc|tuan qua/.test(normalized)) {
    return { fromDate: startOfDay(addDays(today, -7)).toISOString(), toDate: endOfDay(today).toISOString() };
  }
  if (/thang nay/.test(normalized)) {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { fromDate: startOfDay(first).toISOString(), toDate: endOfDay(today).toISOString() };
  }
  if (/thang truoc|thang qua/.test(normalized)) {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { fromDate: startOfDay(first).toISOString(), toDate: endOfDay(last).toISOString() };
  }

  return { fromDate: null, toDate: null };
};

const detectMetric = (normalized) => {
  const hasPressure = /ap suat|ap luc|\bap\b/.test(normalized);
  const hasFlow = /luu luong|\bflow\b/.test(normalized);
  if (/chi so|dong ho|\bmeter\b|san luong tich luy/.test(normalized)) return "meter";
  if (hasPressure && !hasFlow) return "pressure";
  if (hasFlow && !hasPressure) return "flow";
  return "pressureFlow";
};

const detectInterval = (normalized) => {
  const match = normalized.match(/(\d{1,4})\s*(phut|phút|p|min|minute)/);
  if (match) return Math.min(Math.max(Number(match[1]), 5), 1440);
  if (/theo gio|moi gio|hang gio/.test(normalized)) return 60;
  if (/theo ngay|moi ngay|hang ngay/.test(normalized)) return 1440;
  return DEFAULT_INTERVAL_MINUTES;
};

export const sanitizeIntent = (intent = {}) => {
  const action = ALLOWED_ACTIONS.has(intent.action) ? intent.action : "help";
  const metric = REPORT_METRICS[intent.metric] ? intent.metric : "pressureFlow";
  const intervalMinutes = Math.min(
    Math.max(Number(intent.intervalMinutes) || DEFAULT_INTERVAL_MINUTES, 5),
    1440
  );

  const sensorIds = [...new Set(
    (Array.isArray(intent.sensorIds) ? intent.sensorIds : [])
      .map(Number)
      .filter(Number.isFinite)
  )].slice(0, MAX_COMPARE_LOGGERS);

  return {
    action,
    sensorId: Number.isFinite(Number(intent.sensorId)) ? Number(intent.sensorId) : null,
    sensorIds,
    sensorQuery: String(intent.sensorQuery || "").trim().slice(0, 120),
    groupQuery: String(intent.groupQuery || "").trim().slice(0, 120),
    dmaQuery: String(intent.dmaQuery || "").trim().slice(0, 120),
    incidentStatus: INCIDENT_STATUSES.has(intent.incidentStatus) ? intent.incidentStatus : "open",
    fromDate: intent.fromDate || null,
    toDate: intent.toDate || null,
    metric,
    intervalMinutes,
    answer: String(intent.answer || "").trim().slice(0, 600),
  };
};

const findMentionedSensorId = (message, sensorIds) => [...String(message || "").matchAll(/\b\d{2,7}\b/g)]
  .map((match) => Number(match[0]))
  .find((id) => sensorIds.has(id)) ?? null;

const extractSensorQuery = (message) => {
  const match = String(message || "").match(
    /(?:logger|cam bien|cảm biến|diem do|điểm đo)\s+(.+?)(?:\s+(?:từ|tu|ngày|ngay|from|đến|den|trong)\b|$)/i
  );
  return (match?.[1] || "").trim();
};

const findMentionedSensorIds = (message, sensorIds) => [...new Set(
  [...String(message || "").matchAll(/\b\d{2,7}\b/g)]
    .map((match) => Number(match[0]))
    .filter((id) => sensorIds.has(id))
)].slice(0, MAX_COMPARE_LOGGERS);

const extractDmaQuery = (message) => {
  const match = String(message || "").match(
    /(?:dma|vung|vùng|khu)\s+(.+?)(?:\s+(?:từ|tu|ngày|ngay|tháng|thang|tuần|tuan|trong|bao nhiêu|bao nhieu)\b|\?|$)/i
  );
  return (match?.[1] || "").trim();
};

const detectIncidentStatus = (normalized) => {
  if (/da xu ly xong|da xong|da khac phuc|resolved/.test(normalized)) return "resolved";
  if (/dang xu ly|dang sua|in progress/.test(normalized)) return "in_progress";
  if (/tat ca|toan bo|het|all/.test(normalized)) return "all";
  return "open";
};

const extractGroupQuery = (message) => {
  const match = String(message || "").match(/(?:nhóm|nhom|group|khu vực|khu vuc)\s+(.+?)(?:\s+(?:từ|tu|ngày|ngay)\b|$)/i);
  return (match?.[1] || "").trim();
};

const OVERVIEW_PATTERN = /(tong quan|tinh hinh chung|suc khoe he thong|he thong .{0,14}(the nao|ra sao)|bao nhieu logger|may logger|logger nao .{0,10}(offline|online|mat tin hieu)|dang online|dang offline|mat tin hieu|mat ket noi)/;
const INCIDENT_PATTERN = /(su co|ro ri|vo ong|diem su co|incident|dang sua chua)/;
const ALERT_PATTERN = /(canh bao|bao dong|\balarm\b|\balert\b)/;
const DMA_PATTERN = /(that thoat|\bnrw\b|\bdma\b|nuoc khong doanh thu)/;
const COMPARE_PATTERN = /(so sanh|doi chieu|compare|so voi)/;
const ANALYZE_PATTERN = /(phan tich|bat thuong|danh gia|chan doan|co van de|co gi la|nhan dinh|nhan xet|dau hieu)/;

// Nhom duoc nhac dich danh trong cau (so voi danh sach nhom that) - chinh xac hon
// regex "nhom ..." vi cau dai thuong co them chu phia sau ten nhom.
const findKnownGroup = (message, sensors) => {
  const normalized = normalizeText(message);
  return [...new Set(sensors.map((sensor) => sensor.group).filter(Boolean))]
    .filter((group) => normalizeText(group) !== "khong co")
    .sort((a, b) => b.length - a.length)
    .find((group) => normalized.includes(normalizeText(group))) || "";
};

const analyzeIntent = (message, sensors, sensorIds, dateRange) => sanitizeIntent({
  action: "analyze_anomaly",
  sensorIds: findMentionedSensorIds(message, sensorIds),
  groupQuery: findKnownGroup(message, sensors) || extractGroupQuery(message),
  ...dateRange,
});

// Router rẻ tiền: xử lý các mẫu câu phổ biến mà không cần gọi AI.
export const routeDeterministic = (message, sensors) => {
  const normalized = normalizeText(message);
  if (!normalized) return null;

  const sensorIds = new Set(sensors.map((sensor) => Number(sensor.id)));
  const mentionedId = findMentionedSensorId(message, sensorIds);
  const dateRange = extractDateRange(message);

  if (/^(help|huong dan|giup|giup toi|ban lam duoc gi|lam duoc gi|menu)\b/.test(normalized)) {
    return sanitizeIntent({ action: "help" });
  }

  if (/^\d{2,7}$/.test(normalized) && sensorIds.has(Number(normalized))) {
    return sanitizeIntent({ action: "open_logger", sensorId: Number(normalized) });
  }

  if (OVERVIEW_PATTERN.test(normalized)) {
    return sanitizeIntent({ action: "system_overview", groupQuery: extractGroupQuery(message) });
  }

  // Dat truoc su co/canh bao: "phan tich xem co ro ri khong" la yeu cau phan tich,
  // khong phai liet ke diem su co. Rieng that thoat DMA da co cong cu rieng.
  if (ANALYZE_PATTERN.test(normalized) && !DMA_PATTERN.test(normalized)) {
    return analyzeIntent(message, sensors, sensorIds, dateRange);
  }

  if (INCIDENT_PATTERN.test(normalized)) {
    return sanitizeIntent({
      action: "list_incidents",
      sensorId: mentionedId,
      groupQuery: extractGroupQuery(message),
      incidentStatus: detectIncidentStatus(normalized),
      ...dateRange,
    });
  }

  if (ALERT_PATTERN.test(normalized)) {
    return sanitizeIntent({
      action: "list_alerts",
      groupQuery: extractGroupQuery(message),
      ...dateRange,
    });
  }

  if (DMA_PATTERN.test(normalized)) {
    return sanitizeIntent({
      action: "dma_loss",
      dmaQuery: extractDmaQuery(message),
      groupQuery: extractGroupQuery(message),
      ...dateRange,
    });
  }

  const mentionedIds = findMentionedSensorIds(message, sensorIds);
  if (COMPARE_PATTERN.test(normalized) && mentionedIds.length >= 2) {
    return sanitizeIntent({
      action: "compare_loggers",
      sensorIds: mentionedIds,
      metric: detectMetric(normalized),
      intervalMinutes: detectInterval(normalized),
      ...dateRange,
    });
  }

  if (/(liet ke|danh sach|list|co nhung logger nao|logger nao thuoc)/.test(normalized)) {
    return sanitizeIntent({
      action: "list_loggers",
      groupQuery: extractGroupQuery(message) || extractSensorQuery(message),
    });
  }

  const wantsReport = /(bao cao|xuat|export|lay du lieu|du lieu tu|thong ke|tong hop)/.test(normalized);
  if (wantsReport && dateRange.fromDate && (mentionedId || extractSensorQuery(message))) {
    return sanitizeIntent({
      action: "logger_report",
      sensorId: mentionedId,
      sensorQuery: extractSensorQuery(message),
      groupQuery: extractGroupQuery(message),
      metric: detectMetric(normalized),
      intervalMinutes: detectInterval(normalized),
      ...dateRange,
    });
  }

  if (mentionedId && /(mo|xem|chi tiet|thong tin|hien tai|moi nhat|status|trang thai)/.test(normalized) && !wantsReport) {
    return sanitizeIntent({ action: "open_logger", sensorId: mentionedId });
  }

  return null;
};

// Fallback khi AI không dùng được: đoán theo từ khóa, không bao giờ trả lỗi cứng.
export const heuristicIntent = (message, sensors) => {
  const normalized = normalizeText(message);
  const sensorIds = new Set(sensors.map((sensor) => Number(sensor.id)));
  const mentionedId = findMentionedSensorId(message, sensorIds);
  const dateRange = extractDateRange(message);
  const sensorQuery = extractSensorQuery(message);
  const groupQuery = findKnownGroup(message, sensors) || extractGroupQuery(message);

  if (ANALYZE_PATTERN.test(normalized) && !DMA_PATTERN.test(normalized)) {
    return analyzeIntent(message, sensors, sensorIds, dateRange);
  }

  if (/(bao cao|xuat|export|lay du lieu|du lieu tu|tu ngay|den ngay)/.test(normalized)) {
    return sanitizeIntent({
      action: "logger_report",
      sensorId: mentionedId,
      sensorQuery: sensorQuery || message,
      groupQuery,
      metric: detectMetric(normalized),
      intervalMinutes: detectInterval(normalized),
      ...dateRange,
    });
  }

  if (OVERVIEW_PATTERN.test(normalized)) {
    return sanitizeIntent({ action: "system_overview", groupQuery });
  }

  if (INCIDENT_PATTERN.test(normalized)) {
    return sanitizeIntent({
      action: "list_incidents",
      sensorId: mentionedId,
      groupQuery,
      incidentStatus: detectIncidentStatus(normalized),
      ...dateRange,
    });
  }

  if (ALERT_PATTERN.test(normalized)) {
    return sanitizeIntent({ action: "list_alerts", groupQuery, ...dateRange });
  }

  if (DMA_PATTERN.test(normalized)) {
    return sanitizeIntent({
      action: "dma_loss",
      dmaQuery: extractDmaQuery(message),
      groupQuery,
      ...dateRange,
    });
  }

  if (COMPARE_PATTERN.test(normalized) && findMentionedSensorIds(message, sensorIds).length >= 2) {
    return sanitizeIntent({
      action: "compare_loggers",
      sensorIds: findMentionedSensorIds(message, sensorIds),
      metric: detectMetric(normalized),
      intervalMinutes: detectInterval(normalized),
      ...dateRange,
    });
  }

  if (/(liet ke|danh sach|logger nao|cam bien nao)/.test(normalized)) {
    return sanitizeIntent({ action: "list_loggers", groupQuery: groupQuery || sensorQuery });
  }

  if (mentionedId || /(mo|xem|chi tiet|du lieu)/.test(normalized)) {
    return sanitizeIntent({
      action: "open_logger",
      sensorId: mentionedId,
      sensorQuery: sensorQuery || message,
    });
  }

  return sanitizeIntent({ action: "help" });
};

const buildIntentMessages = ({ message, sensors, session }) => {
  const today = formatShortDate(new Date());
  const catalog = sensors.slice(0, MAX_SENSOR_PROMPT_ITEMS).map((sensor) => ({
    id: sensor.id,
    name: sensor.name,
    group: sensor.group || "Không có",
  }));

  const history = (session?.turns || [])
    .map((turn) => `${turn.role === "user" ? "Người dùng" : "Trợ lý"}: ${turn.content}`)
    .join("\n");

  const slots = session?.slots || {};

  return [
    {
      role: "system",
      content: "Bạn là bộ phân loại câu lệnh cho backend chỉ-đọc của hệ thống logger nước. Chỉ trả về một object JSON hợp lệ, không markdown, không giải thích.",
    },
    {
      role: "user",
      content: `Ngày hiện tại theo giờ Việt Nam: ${today}.

QUY TẮC:
- "hôm nay" = ${today}. Ngày không kèm giờ: fromDate 00:00:00+07:00, toDate 23:59:59+07:00.
- Hỏi báo cáo/xuất/lấy dữ liệu MỘT logger theo khoảng ngày => action "logger_report".
- Hỏi so sánh/đối chiếu NHIỀU logger với nhau => action "compare_loggers", điền toàn bộ id vào "sensorIds" (tối đa 5).
- Yêu cầu PHÂN TÍCH, đánh giá, tìm bất thường, chẩn đoán rò rỉ/tụt áp của một nhóm hoặc các logger => action "analyze_anomaly",
  tên nhóm vào "groupQuery" (đúng tên trong danh sách), id logger (nếu có) vào "sensorIds". Ưu tiên action này hơn "logger_report" khi câu có ý phân tích.
- Hỏi mở/xem/chi tiết/trạng thái một logger => action "open_logger".
- Hỏi danh sách logger hoặc logger trong một nhóm => action "list_loggers".
- Hỏi tổng quan hệ thống, bao nhiêu logger online/offline, logger nào mất tín hiệu => action "system_overview".
- Hỏi sự cố hiện trường (rò rỉ, vỡ ống, đang sửa chữa, điểm sự cố) => action "list_incidents".
  "incidentStatus": "open" nếu hỏi chưa xử lý, "in_progress" nếu đang xử lý, "resolved" nếu đã xong, "all" nếu hỏi tất cả.
  Nếu hỏi sự cố quanh một logger thì điền "sensorId".
- Hỏi cảnh báo/báo động của hệ thống theo ngày => action "list_alerts".
- Hỏi thất thoát, NRW, nước không doanh thu, hoặc nhắc tên một DMA => action "dma_loss", tên DMA vào "dmaQuery".
- Yêu cầu sửa/xóa/cập nhật/ghi cấu hình xuống thiết bị => action "refuse".
- Câu hỏi chung chung, chào hỏi, không rõ => action "help", viết câu gợi ý vào "answer".
- Hệ thống chỉ đọc dữ liệu, không bao giờ sinh action ghi.
- Nếu người dùng nói tiếp nối ("báo cáo hôm qua đi", "còn logger đó thì sao"), dùng NGỮ CẢNH bên dưới để điền sensorId.

SCHEMA:
{
  "action": "logger_report" | "compare_loggers" | "analyze_anomaly" | "open_logger" | "list_loggers" | "system_overview" | "list_incidents" | "list_alerts" | "dma_loss" | "help" | "refuse",
  "sensorId": number | null,
  "sensorIds": number[],
  "sensorQuery": string,
  "groupQuery": string,
  "dmaQuery": string,
  "incidentStatus": "open" | "in_progress" | "resolved" | "all",
  "fromDate": "ISO 8601 +07:00" | null,
  "toDate": "ISO 8601 +07:00" | null,
  "metric": "pressureFlow" | "pressure" | "flow" | "meter",
  "intervalMinutes": number,
  "answer": string
}

NGỮ CẢNH PHIÊN:
${JSON.stringify({ lastSensorId: slots.sensorId ?? null, lastGroup: slots.groupQuery ?? null, lastFromDate: slots.fromDate ?? null, lastToDate: slots.toDate ?? null })}

${history ? `LỊCH SỬ HỘI THOẠI:\n${history}\n` : ""}
DANH SÁCH LOGGER:
${JSON.stringify(catalog)}

CÂU LỆNH: ${message}`,
    },
  ];
};

const isValidIntentShape = (data) => Boolean(data) && typeof data === "object" && typeof data.action === "string";

export const parseIntent = async ({ message, sensors, session, signal, beforeAiCall }) => {
  const fastPath = routeDeterministic(message, sensors);
  if (fastPath) return { intent: fastPath, source: "rules", meta: null, aiUsage: null, aiFailed: false };

  // Quota chỉ bị trừ khi thật sự phải gọi model.
  const aiUsage = beforeAiCall ? await beforeAiCall() : null;

  try {
    const { data, meta } = await chatCompleteJson({
      messages: buildIntentMessages({ message, sensors, session }),
      validate: isValidIntentShape,
      signal,
      longForm: false,
    });
    return { intent: sanitizeIntent(data), source: "ai", meta, aiUsage, aiFailed: false };
  } catch (error) {
    if (error?.statusCode === 499) throw error;
    console.error("[agent] intent parse fallback:", error.message);
    return {
      intent: heuristicIntent(message, sensors),
      source: "heuristic",
      meta: null,
      aiUsage,
      aiFailed: true,
      error,
    };
  }
};

export const applySessionSlots = (intent, session) => {
  const slots = session?.slots || {};
  const merged = { ...intent };

  if (!merged.sensorId && !merged.sensorQuery && slots.sensorId) {
    merged.sensorId = slots.sensorId;
  }
  const NEEDS_RANGE = new Set(["logger_report", "compare_loggers", "dma_loss"]);
  if (NEEDS_RANGE.has(merged.action) && !merged.fromDate && slots.fromDate) {
    merged.fromDate = slots.fromDate;
    merged.toDate = slots.toDate;
  }
  if (!merged.groupQuery && slots.groupQuery && merged.action === "list_loggers") {
    merged.groupQuery = slots.groupQuery;
  }
  // "Phan tich tiep nhom do thang truoc" -> dung lai nhom vua hoi.
  if (merged.action === "analyze_anomaly" && !merged.groupQuery && !merged.sensorIds.length) {
    if (slots.groupQuery) merged.groupQuery = slots.groupQuery;
    else if (slots.sensorId) merged.sensorIds = [slots.sensorId];
  }
  if (merged.action === "dma_loss" && !merged.dmaQuery && slots.dmaQuery) {
    merged.dmaQuery = slots.dmaQuery;
  }
  if (merged.action === "compare_loggers" && merged.sensorIds.length < 2 && merged.sensorId) {
    merged.sensorIds = [...new Set([merged.sensorId, ...merged.sensorIds])];
  }

  return merged;
};
