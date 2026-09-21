import axios from "axios";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config({
  path: fileURLToPath(new URL("../../.env.external-loggers", import.meta.url)),
  override: false,
});

const providerId = "npt";
const providerName = "NPT / Watersense";
const defaultBaseUrl = "https://api.watersense.vn/api/v1";
const requestTimeoutMs = 30000;

const normalizeText = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .replace(/Đ/g, "D")
  .toLowerCase();

const flattenObject = (value, prefix = "", depth = 0) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 2) return [];

  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return flattenObject(item, path, depth + 1);
    }
    return Array.isArray(item) ? [] : [[path, item]];
  });
};

const findValue = (record, candidates) => {
  const entries = flattenObject(record);
  for (const candidate of candidates.map(normalizeText)) {
    const exact = entries.find(([key]) => normalizeText(key.split(".").pop()) === candidate);
    if (exact) return exact[1];
  }
  return undefined;
};

const collectArrays = (value, path = [], result = [], depth = 0, parent = null) => {
  if (depth > 7 || value === null || value === undefined) return result;
  if (Array.isArray(value)) {
    result.push({ path, values: value, parent });
    value.slice(0, 3).forEach((item, index) => {
      if (item && typeof item === "object") collectArrays(item, [...path, String(index)], result, depth + 1, value);
    });
    return result;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => collectArrays(item, [...path, key], result, depth + 1, value));
  }
  return result;
};

const pointNumberFields = ["smsNumber", "number", "loggerNumber", "serialNumber", "serial", "imei", "deviceNumber", "loggerNo", "pointId", "code", "id"];

const getPointArray = (payload) => {
  const arrays = collectArrays(payload).filter(({ values }) => values.some((item) => item && typeof item === "object" && !Array.isArray(item)));
  return arrays.sort((a, b) => {
    const score = ({ values }) => values.slice(0, 10).reduce((sum, item) => (
      sum + (findValue(item, pointNumberFields) !== undefined ? 5 : 0) + Object.keys(item || {}).length
    ), 0);
    return score(b) - score(a);
  })[0]?.values || [];
};

const normalizePoint = (point, index) => {
  const loggerDevice = Array.isArray(point.devices)
    ? point.devices.find((device) => normalizeText(device.deviceType) === "logger") || point.devices[0]
    : null;
  const number = findValue(loggerDevice, pointNumberFields) ?? findValue(point, pointNumberFields);
  if (number === undefined || number === null || number === "") return null;
  const alertStatus = Number(findValue(point, ["alertStatus"]));
  const returnedStatus = String(findValue(point, ["connectionStatus", "severity", "status"]) || "").toUpperCase();
  const status = alertStatus === 1 ? "SUCCESS" : returnedStatus || "DISCONNECTED";

  return {
    number: String(number),
    name: String(findValue(point, ["pointName", "loggerName", "deviceName", "stationName", "name", "description"]) || `Logger ${number}`),
    group: String(findValue(point, ["branchName", "areaName", "zoneName", "groupName", "group", "companyName", "customerName"]) || "Không có"),
    address: String(findValue(point, ["address", "locationName", "location", "place"]) || ""),
    status,
    connected: status === "SUCCESS",
    alertMessage: String(findValue(point, ["alertMessage", "message"]) || ""),
    lastUpdate: findValue(point, ["lastUpdate", "updatedAt", "lastDataTime", "lastTime", "time"]),
    order: index,
  };
};

const timestampFields = [
  "timestamp", "timeStamp", "datetime", "dateTime", "deviceTime", "loggerTime", "recordedAt",
  "createdAt", "createAt", "logTime", "dataTime", "loggingTime", "time", "date",
];

const metadataFields = new Set([
  "id", "index", "number", "loggernumber", "serialnumber", "serial", "imei", "status", "state",
  "latitude", "longitude", "lat", "lng", "order", "channelid", "deviceid",
]);

const toIsoTimestamp = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 1e12 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const text = String(value).trim();
  const localMatch = text.match(/^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  const parseValue = localMatch
    ? `${localMatch[1]}-${localMatch[2]}-${localMatch[3]}T${localMatch[4]}:${localMatch[5]}:${localMatch[6] || "00"}+07:00`
    : text;
  const date = new Date(parseValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const slugify = (value) => normalizeText(value)
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "") || "value";

const classifyChannel = (rawKey) => {
  const normalized = normalizeText(rawKey).replace(/[^a-z0-9]+/g, "");
  if (normalized.includes("flow") || normalized.includes("luuluong")) {
    return { key: "flow", label: "Lưu lượng", unit: "m³/h" };
  }
  if (normalized.includes("pressure") || normalized.includes("apsuat") || normalized === "press") {
    return { key: "pressure", label: "Áp suất", unit: "m" };
  }
  if (normalized.includes("meter") || normalized.includes("total") || normalized.includes("sum") || normalized.includes("chisodongho")) {
    return { key: "meter", label: "Chỉ số đồng hồ", unit: "m³" };
  }
  if (normalized.includes("battery") || normalized.includes("pin")) {
    return { key: "battery", label: "Pin", unit: "%" };
  }
  return { key: slugify(rawKey), label: String(rawKey || "Giá trị"), unit: "" };
};

const getTimestampEntry = (record) => {
  const entries = flattenObject(record);
  const candidates = timestampFields.map(normalizeText);
  return entries.find(([key]) => candidates.includes(normalizeText(key.split(".").pop())));
};

const getNumericEntries = (record) => flattenObject(record)
  .filter(([key, value]) => {
    const leafKey = normalizeText(key.split(".").pop()).replace(/[^a-z0-9]/g, "");
    return !metadataFields.has(leafKey) && value !== "" && Number.isFinite(Number(value));
  });

const rowArrayScore = ({ values }) => values.slice(0, 20).reduce((score, row) => {
  if (!row || typeof row !== "object" || Array.isArray(row)) return score;
  const timestamp = getTimestampEntry(row);
  const numericEntries = getNumericEntries(row).filter(([key]) => normalizeText(key.split(".").pop()) !== "value");
  return score + (timestamp ? 8 : 0) + numericEntries.length * 2;
}, 0);

const normalizeTabularRecords = (payload) => {
  const candidate = collectArrays(payload)
    .filter(({ values }) => values.some((item) => item && typeof item === "object" && !Array.isArray(item)))
    .sort((a, b) => rowArrayScore(b) - rowArrayScore(a))[0];

  if (!candidate || rowArrayScore(candidate) === 0) return { records: [], channels: [] };

  const channelMap = new Map();
  const records = candidate.values.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const timestampEntry = getTimestampEntry(row);
    const timestamp = toIsoTimestamp(timestampEntry?.[1]);
    if (!timestamp) return [];

    const values = {};
    getNumericEntries(row).forEach(([rawKey, rawValue]) => {
      const leafKey = rawKey.split(".").pop();
      if (timestampEntry?.[0] === rawKey) return;
      const channel = classifyChannel(leafKey);
      let key = channel.key;
      if (channelMap.has(key) && channelMap.get(key).source !== leafKey) key = `${key}_${slugify(leafKey)}`;
      channelMap.set(key, { ...channel, key, source: leafKey });
      values[key] = Number(rawValue);
    });
    return Object.keys(values).length ? [{ timestamp, values }] : [];
  });

  return {
    records,
    channels: [...channelMap.values()].map(({ source, ...channel }) => channel),
  };
};

const getSeriesLabel = ({ path, parent }) => {
  const firstRow = Array.isArray(parent)
    ? parent.find((item) => item && typeof item === "object" && !Array.isArray(item))
    : null;
  const parentLabel = parent && !Array.isArray(parent)
    ? findValue(parent, ["channelName", "parameterName", "displayName", "label", "name", "channel", "type"])
    : null;
  const rowLabel = findValue(firstRow, ["channelName", "parameterName", "displayName", "label", "name", "channel", "type"]);
  const pathLabel = [...path].reverse().find((part) => !/^(data|values|points|items|list|result|\d+)$/i.test(part));
  return String(parentLabel || rowLabel || pathLabel || "value");
};

const normalizeSeriesRecords = (payload) => {
  const recordsByTime = new Map();
  const channelMap = new Map();

  collectArrays(payload).forEach((candidate) => {
    const timestampRowCount = candidate.values.reduce((count, point) => {
      if (Array.isArray(point) && point.length >= 2) return count + (toIsoTimestamp(point[0]) ? 1 : 0);
      if (point && typeof point === "object") return count + (toIsoTimestamp(getTimestampEntry(point)?.[1]) ? 1 : 0);
      return count;
    }, 0);
    if (timestampRowCount < Math.min(2, candidate.values.length)) return;

    const firstRow = candidate.values.find((item) => item && typeof item === "object" && !Array.isArray(item));
    const channelBase = classifyChannel(findValue(firstRow, ["channelName"]) || getSeriesLabel(candidate));
    const reportedUnit = findValue(firstRow, ["unit"]);
    if (reportedUnit) channelBase.unit = String(reportedUnit).replace("m3", "m³");
    let parsedCount = 0;

    candidate.values.forEach((point) => {
      let timestamp;
      if (Array.isArray(point) && point.length >= 2) {
        timestamp = toIsoTimestamp(point[0]);
        const value = Number(point[1]);
        if (!timestamp || !Number.isFinite(value)) return;
        const record = recordsByTime.get(timestamp) || { timestamp, values: {} };
        record.values[channelBase.key] = value;
        recordsByTime.set(timestamp, record);
        channelMap.set(channelBase.key, channelBase);
        parsedCount += 1;
      } else if (point && typeof point === "object") {
        timestamp = toIsoTimestamp(getTimestampEntry(point)?.[1]);
        if (!timestamp) return;
        const record = recordsByTime.get(timestamp) || { timestamp, values: {} };
        getNumericEntries(point).forEach(([rawKey, rawValue]) => {
          const leafKey = rawKey.split(".").pop();
          const normalizedLeaf = normalizeText(leafKey);
          const channel = ["value", "val", "y", "reading"].includes(normalizedLeaf)
            ? channelBase
            : classifyChannel(leafKey);
          record.values[channel.key] = Number(rawValue);
          channelMap.set(channel.key, channel);
        });
        if (!Object.keys(record.values).length) return;
        recordsByTime.set(timestamp, record);
        parsedCount += 1;
      }
    });

    if (parsedCount && !channelMap.has(channelBase.key)) channelMap.set(channelBase.key, channelBase);
  });

  return {
    records: [...recordsByTime.values()],
    channels: [...channelMap.values()],
  };
};

const downsampleRecords = (records, intervalMinutes) => {
  const interval = Math.max(1, Math.min(Number(intervalMinutes) || 1, 1440));
  if (interval <= 1) return records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const buckets = new Map();
  records.forEach((record) => {
    const time = new Date(record.timestamp).getTime();
    if (!Number.isFinite(time)) return;
    const bucketTime = Math.floor(time / (interval * 60000)) * interval * 60000;
    const bucket = buckets.get(bucketTime) || {};
    Object.entries(record.values || {}).forEach(([key, value]) => {
      if (!Number.isFinite(Number(value))) return;
      const stat = bucket[key] || { total: 0, count: 0, latest: null, latestTime: -Infinity };
      stat.total += Number(value);
      stat.count += 1;
      if (time >= stat.latestTime) {
        stat.latest = Number(value);
        stat.latestTime = time;
      }
      bucket[key] = stat;
    });
    buckets.set(bucketTime, bucket);
  });

  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([time, bucket]) => ({
    timestamp: new Date(time).toISOString(),
    values: Object.fromEntries(Object.entries(bucket).map(([key, stat]) => [
      key,
      key === "meter" ? stat.latest : Number((stat.total / stat.count).toFixed(3)),
    ])),
  }));
};

const formatProviderDate = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) throw new Error("Thời gian không hợp lệ");
  return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}:${match[6] || "00"}`;
};

const getConfig = () => ({
  baseUrl: process.env.EXTERNAL_LOGGER_NPT_BASE_URL || defaultBaseUrl,
  token: process.env.EXTERNAL_LOGGER_NPT_TOKEN || process.env.WATERSENSE_TOKEN || "",
});

const assertConfigured = () => {
  const config = getConfig();
  if (!config.token) {
    const error = new Error("Nguồn NPT chưa được cấu hình token trên máy chủ");
    error.code = "PROVIDER_NOT_CONFIGURED";
    throw error;
  }
  return config;
};

const request = async (path, params) => {
  const config = assertConfigured();
  const response = await axios.get(`${config.baseUrl}${path}`, {
    params,
    timeout: requestTimeoutMs,
    headers: {
      accept: "application/json, text/plain, */*",
      authorization: config.token,
    },
  });
  return response.data;
};

export const watersenseProvider = {
  id: providerId,
  name: providerName,
  isConfigured: () => Boolean(getConfig().token),

  async getPoints() {
    const payload = await request("/points/all");
    return getPointArray(payload)
      .map(normalizePoint)
      .filter(Boolean)
      .sort((a, b) => a.order - b.order)
      .map(({ order, ...point }) => point);
  },

  async getLoggerData({ number, fromDate, toDate, intervalMinutes }) {
    const payload = await request("/logger/all-channel-data", {
      flowUnit: "m3/h",
      pressureUnit: "m",
      fromDate: formatProviderDate(fromDate),
      toDate: formatProviderDate(toDate),
      number,
    });

    const series = normalizeSeriesRecords(payload);
    const normalized = series.records.length ? series : normalizeTabularRecords(payload);
    return {
      number: String(number),
      channels: normalized.channels,
      records: downsampleRecords(normalized.records, intervalMinutes),
    };
  },
};
