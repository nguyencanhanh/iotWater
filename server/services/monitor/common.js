export const TZ = "Asia/Ho_Chi_Minh";

const KIND_LABELS = {
  pressure_drop: "Tụt áp bất thường",
  pressure_surge: "Áp tăng vọt bất thường",
  flow_zero: "Mất lưu lượng",
  offline: "Mất tín hiệu",
  mnf_rise: "Lưu lượng đêm tăng dần",
  mnf_high: "Lưu lượng đêm cao",
};

export const getKindLabel = (kind) => KIND_LABELS[kind] || kind;

export const formatVnTime = (date, withDate = false) => new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  ...(withDate ? { day: "2-digit", month: "2-digit" } : {}),
}).format(new Date(date));
