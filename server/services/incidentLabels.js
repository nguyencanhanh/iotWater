// Nhan tieng Viet cho diem su co, dung khi dua du lieu vao prompt AI.
const TYPE_LABELS = {
  leak: "Rò rỉ",
  burst: "Vỡ ống",
  repair: "Đang sửa chữa",
  valve: "Van",
  meter: "Đồng hồ",
  other: "Khác",
};

const SEVERITY_LABELS = {
  low: "Nhẹ",
  medium: "Trung bình",
  high: "Nghiêm trọng",
};

const STATUS_LABELS = {
  open: "Chưa xử lý",
  in_progress: "Đang xử lý",
  resolved: "Đã xử lý",
};

export const getTypeLabel = (value) => TYPE_LABELS[value] || TYPE_LABELS.other;
export const getSeverityLabel = (value) => SEVERITY_LABELS[value] || SEVERITY_LABELS.medium;
export const getStatusLabel = (value) => STATUS_LABELS[value] || STATUS_LABELS.open;
