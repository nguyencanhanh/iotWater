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

// Mau dam dan theo muc do, de nhin tren ban do biet ngay cho nao nang.
export const getLeakColor = (key) => {
  const bucket = BY_KEY[key];
  if (!bucket) return "#64748b";
  if (bucket.max === null || bucket.min >= 500) return "#b91c1c";
  if (bucket.min >= 250) return "#dc2626";
  if (bucket.min >= 150) return "#ea580c";
  if (bucket.min >= 50) return "#f59e0b";
  return "#0ea5e9";
};

// 5 dai mau dung cho chu giai + loc tren ban do. Moi dai gom nhieu bac 50 l/h,
// phai khop voi nguong trong getLeakColor o tren.
export const LEAK_COLOR_BANDS = [
  { key: "0-50", label: "0 – 50 l/h", min: 0, max: 50 },
  { key: "50-150", label: "50 – 150 l/h", min: 50, max: 150 },
  { key: "150-250", label: "150 – 250 l/h", min: 150, max: 250 },
  { key: "250-500", label: "250 – 500 l/h", min: 250, max: 500 },
  { key: ">=500", label: "≥ 500 l/h", min: 500, max: null },
].map((band) => ({ ...band, color: getLeakColor(`${band.min}-${band.min + STEP}`) }));

export const getLeakBandKey = (leakKey) => {
  const bucket = BY_KEY[leakKey];
  if (!bucket) return null;
  return LEAK_COLOR_BANDS.find((band) => bucket.min >= band.min && (band.max === null || bucket.min < band.max))?.key || null;
};
