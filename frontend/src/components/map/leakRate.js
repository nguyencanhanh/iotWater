// Bac muc do ro ri theo lit/gio, phai khop voi server/services/leakRate.js
const STEP = 50;
const MAX_STEP = 1000;

export const LEAK_RATE_BUCKETS = [
  ...Array.from({ length: MAX_STEP / STEP }, (unused, index) => {
    const min = index * STEP;
    const max = min + STEP;
    return { key: `${min}-${max}`, min, max, label: `${min} - ${max} l/h` };
  }),
  { key: ">1000", min: MAX_STEP, max: null, label: "> 1000 l/h" },
];

const BY_KEY = Object.fromEntries(LEAK_RATE_BUCKETS.map((item) => [item.key, item]));

export const getLeakBucket = (key) => BY_KEY[key] || null;
export const getLeakLabel = (key) => BY_KEY[key]?.label || "—";
export const estimateLeakRate = (key) => {
  const bucket = BY_KEY[key];
  if (!bucket) return 0;
  return bucket.max === null ? bucket.min : (bucket.min + bucket.max) / 2;
};

// 10 dai mau theo muc do (truoc chi 5): xanh -> vang -> cam -> do -> tim, de nhin tren ban do
// biet ngay cho nao nang. Dung cho ghim, chu giai va bo loc "muc do".
export const LEAK_COLOR_BANDS = [
  { key: "0-50", label: "0 – 50 l/h", min: 0, max: 50, color: "#0ea5e9" },
  { key: "50-100", label: "50 – 100 l/h", min: 50, max: 100, color: "#06b6d4" },
  { key: "100-150", label: "100 – 150 l/h", min: 100, max: 150, color: "#10b981" },
  { key: "150-200", label: "150 – 200 l/h", min: 150, max: 200, color: "#84cc16" },
  { key: "200-250", label: "200 – 250 l/h", min: 200, max: 250, color: "#eab308" },
  { key: "250-300", label: "250 – 300 l/h", min: 250, max: 300, color: "#f59e0b" },
  { key: "300-400", label: "300 – 400 l/h", min: 300, max: 400, color: "#f97316" },
  { key: "400-500", label: "400 – 500 l/h", min: 400, max: 500, color: "#ef4444" },
  { key: "500-1000", label: "500 – 1000 l/h", min: 500, max: 1000, color: "#b91c1c" },
  { key: ">1000", label: "> 1000 l/h", min: 1000, max: null, color: "#7e22ce" },
];

const findBand = (key) => {
  const bucket = BY_KEY[key];
  if (!bucket) return null;
  return LEAK_COLOR_BANDS.find((band) => bucket.min >= band.min && (band.max === null || bucket.min < band.max)) || null;
};

export const getLeakColor = (key) => findBand(key)?.color || "#64748b";

export const getLeakBandKey = (leakKey) => findBand(leakKey)?.key || null;
