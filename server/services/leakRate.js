// Bac muc do ro ri theo lit/gio. Buoc 50 l/h tu 0 den 1000, tren 1000 gom lam mot bac.
// Dung de uoc tinh luu luong that thoat triet tieu trong bao cao (lay trung binh bac).
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

const BUCKET_BY_KEY = Object.fromEntries(LEAK_RATE_BUCKETS.map((item) => [item.key, item]));

export const getLeakBucket = (key) => BUCKET_BY_KEY[key] || null;

export const normalizeLeakRateKey = (key) => (BUCKET_BY_KEY[key] ? key : LEAK_RATE_BUCKETS[0].key);

export const getLeakBucketLabel = (key) => getLeakBucket(key)?.label || "";

// Bac ">1000" khong co can tren nen lay dung 1000 cho an toan, khong thoi phong con so.
export const estimateLeakRate = (key) => {
  const bucket = getLeakBucket(key);
  if (!bucket) return 0;
  return bucket.max === null ? bucket.min : (bucket.min + bucket.max) / 2;
};
