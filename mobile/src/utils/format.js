export const todayInput = () => new Date().toISOString().slice(0, 10);

export const startOfDayIso = (date = todayInput()) => `${date}T00:00:00.000Z`;

export const endOfDayIso = (date = todayInput()) => `${date}T23:59:59.000Z`;

export const formatNumber = (value, digits = 2) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return number.toLocaleString("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  });
};

export const getUserNumber = (user) => Number(user?.user ?? user?._id ?? 0);

export const lastNumber = (values) => {
  if (!Array.isArray(values)) return null;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] !== null && values[i] !== undefined) return values[i];
  }
  return null;
};

export const extractLatest = (values, sensor) => {
  if (!sensor) return null;
  if (Array.isArray(values)) {
    return values[sensor.id] || values.find((item) => item?.index === sensor.id);
  }
  return values?.[sensor.id] || values?.[String(sensor.id)] || null;
};
