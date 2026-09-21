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
