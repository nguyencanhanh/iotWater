import Alarm from "../../models/AlarmFlow.js";
import InfoSen from "../../models/Info.js";
import MapPoint from "../../models/MapPoint.js";
import Sensor from "../../models/Sensor.js";
import { calculateDmaResult, findDmaByQuery } from "../dma/engine.js";
import { findIncidentsNearLoggers } from "../incidents.js";
import { getSeverityLabel, getStatusLabel, getTypeLabel } from "../incidentLabels.js";
import { normalizeText, REPORT_METRICS } from "./intent.js";

const MAX_CHAT_REPORT_LOGGERS = 5;
const MAX_CHAT_REPORT_LABELS = 1800;
const DEFAULT_INTERVAL_MINUTES = 60;
const TZ = "Asia/Ho_Chi_Minh";

export const formatLocalDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const getNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
};

export const listSensors = (user) => InfoSen.find({ user })
  .select("id name group lat lng interval adj")
  .sort({ sortOrder: 1, createAt: -1 })
  .lean();

export const findSensorCandidates = ({ sensors, sensorId, sensorQuery, message, groupQuery }) => {
  if (Number.isFinite(Number(sensorId))) {
    const exact = sensors.find((sensor) => Number(sensor.id) === Number(sensorId));
    if (exact) return { selected: exact, candidates: [exact] };
  }

  const query = normalizeText(sensorQuery || message);
  const group = normalizeText(groupQuery);
  if (!query && !group) return { selected: null, candidates: [] };

  const queryWords = query.split(" ").filter((word) => word.length >= 3);

  const scored = sensors
    .map((sensor) => {
      const name = normalizeText(sensor.name);
      const sensorGroup = normalizeText(sensor.group || "Không có");
      const idText = String(sensor.id);
      let score = 0;

      if (query === idText) score += 120;
      else if (query.includes(idText)) score += 100;
      if (name && query === name) score += 100;
      else if (name && query.includes(name)) score += 80;
      else if (name && query.length >= 3 && name.includes(query)) score += 70;
      if (query.length >= 3 && sensorGroup.includes(query)) score += 45;
      if (group && sensorGroup.includes(group)) score += 60;
      queryWords.forEach((word) => {
        if (name.includes(word)) score += 10;
      });

      return { sensor, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, 8).map((item) => item.sensor);
  const best = scored[0];
  const runnerUp = scored[1];
  const selected = best && (best.score >= 80 || best.score >= (runnerUp?.score || 0) + 20)
    ? best.sensor
    : null;

  return { selected, candidates };
};

const getBucketLabels = ({ start, end, intervalMs }) => {
  const labels = [];
  for (let time = start.getTime(); time <= end.getTime(); time += intervalMs) {
    labels.push(new Date(time).toISOString());
  }
  return labels;
};

const buildStatsFromValues = (values, extra = {}) => {
  const realValues = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  const sum = realValues.reduce((total, value) => total + value, 0);
  return {
    min: realValues.length ? Math.min(...realValues) : null,
    max: realValues.length ? Math.max(...realValues) : null,
    avg: realValues.length ? sum / realValues.length : null,
    count: extra.count || 0,
    volume: getNumber(extra.volume),
    firstAt: extra.firstAt || null,
    lastAt: extra.lastAt || null,
  };
};

const createEvenSamples = ({ labels, pressureValues, flowValues, meterValues, maxRows = 24 }) => {
  const length = labels.length;
  if (!length) return [];
  const step = Math.max(Math.ceil(length / maxRows), 1);
  const rows = [];

  for (let index = 0; index < length; index += step) {
    rows.push({
      time: formatLocalDateTime(labels[index]),
      pressure: getNumber(pressureValues?.[index]),
      flow: getNumber(flowValues?.[index]),
      meter: getNumber(meterValues?.[index]),
    });
  }

  const lastIndex = length - 1;
  if (rows[rows.length - 1]?.time !== formatLocalDateTime(labels[lastIndex])) {
    rows.push({
      time: formatLocalDateTime(labels[lastIndex]),
      pressure: getNumber(pressureValues?.[lastIndex]),
      flow: getNumber(flowValues?.[lastIndex]),
      meter: getNumber(meterValues?.[lastIndex]),
    });
  }

  return rows;
};

export const buildLoggerReport = async ({ user, loggerIds, fromDate, toDate, intervalMinutes }) => {
  const ids = [...new Set(loggerIds.map(Number).filter(Number.isFinite))].slice(0, MAX_CHAT_REPORT_LOGGERS);
  const start = new Date(fromDate);
  const end = new Date(toDate);

  if (!ids.length) throw new Error("Chưa chọn logger");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error("Khoảng thời gian không hợp lệ");
  }

  const intervalMs = Math.min(Math.max(Number(intervalMinutes) || DEFAULT_INTERVAL_MINUTES, 5), 1440) * 60 * 1000;
  const labels = getBucketLabels({ start, end, intervalMs });
  if (labels.length > MAX_CHAT_REPORT_LABELS) {
    throw new Error("Khoảng thời gian quá dài. Hãy tăng khoảng hiển thị hoặc thu hẹp ngày.");
  }

  const startMs = start.getTime();
  const matchStage = { user, index: { $in: ids }, createAt: { $gte: start, $lte: end } };

  const [infos, buckets, stats] = await Promise.all([
    InfoSen.find({ user, id: { $in: ids } }).select("id name group adj").lean(),
    Sensor.aggregate([
      { $match: matchStage },
      { $sort: { createAt: 1 } },
      {
        $addFields: {
          bucketTime: {
            $toDate: {
              $add: [
                startMs,
                {
                  $multiply: [
                    { $floor: { $divide: [{ $subtract: [{ $toLong: "$createAt" }, startMs] }, intervalMs] } },
                    intervalMs,
                  ],
                },
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: { index: "$index", bucket: "$bucketTime" },
          avgPressure: { $avg: "$Pressure" },
          avgFlow: { $avg: "$flow" },
          lastSum: { $last: "$sum" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.bucket": 1 } },
    ]).allowDiskUse(true),
    Sensor.aggregate([
      { $match: matchStage },
      { $sort: { createAt: 1 } },
      {
        $group: {
          _id: "$index",
          firstSum: { $first: "$sum" },
          lastSum: { $last: "$sum" },
          firstAt: { $first: "$createAt" },
          lastAt: { $last: "$createAt" },
          count: { $sum: 1 },
        },
      },
    ]).allowDiskUse(true),
  ]);

  const infoById = Object.fromEntries(infos.map((info) => [Number(info.id), info]));
  const statById = Object.fromEntries(stats.map((item) => [Number(item._id), item]));
  const bucketByLogger = buckets.reduce((result, item) => {
    const id = Number(item._id.index);
    const label = item._id.bucket.toISOString();
    if (!result[id]) result[id] = {};
    result[id][label] = item;
    return result;
  }, {});

  const series = ids.map((id) => {
    const info = infoById[id] || {};
    const stat = statById[id] || {};
    const adjust = Number(info.adj || 0);

    const pressureValues = labels.map((label) => {
      const value = bucketByLogger[id]?.[label]?.avgPressure;
      return Number.isFinite(Number(value)) ? Number(value) + adjust : null;
    });
    const flowValues = labels.map((label) => {
      const value = bucketByLogger[id]?.[label]?.avgFlow;
      return Number.isFinite(Number(value)) ? Number(value) : null;
    });
    const meterValues = labels.map((label) => {
      const value = bucketByLogger[id]?.[label]?.lastSum;
      return Number.isFinite(Number(value)) ? Number(value) : null;
    });

    const volume = Number(stat.lastSum ?? 0) - Number(stat.firstSum ?? 0);

    return {
      id,
      name: info.name || `Logger ${id}`,
      group: info.group || "Không có",
      pressureValues,
      flowValues,
      meterValues,
      pressureStats: buildStatsFromValues(pressureValues, stat),
      flowStats: buildStatsFromValues(flowValues, {
        ...stat,
        volume: Number.isFinite(volume) && volume > 0 ? volume : 0,
      }),
      meterStats: buildStatsFromValues(meterValues, stat),
      samples: createEvenSamples({ labels, pressureValues, flowValues, meterValues }),
    };
  });

  return {
    labels,
    series,
    metric: REPORT_METRICS.pressureFlow,
    intervalMinutes: intervalMs / 60000,
    fromDate: start.toISOString(),
    toDate: end.toISOString(),
  };
};

export const buildReportPayload = (reportData) => {
  const first = reportData.series[0];
  return {
    type: "logger_report",
    reportData,
    summary: {
      loggerCount: reportData.series.length,
      labelCount: reportData.labels.length,
      fromDate: formatLocalDateTime(reportData.fromDate),
      toDate: formatLocalDateTime(reportData.toDate),
      totalVolume: getNumber(
        reportData.series.reduce((sum, item) => sum + Number(item.flowStats?.volume || 0), 0)
      ),
      pressureAvg: getNumber(first?.pressureStats?.avg),
      flowAvg: getNumber(first?.flowStats?.avg),
    },
  };
};

export const buildOpenLoggerPayload = async ({ user, sensor }) => {
  const latest = await Sensor.findOne({ user, index: Number(sensor.id) }).sort({ createAt: -1 }).lean();
  const latestTime = latest?.createAt ? new Date(latest.createAt).getTime() : 0;
  const onlineAfter = Date.now() - (Number(sensor.interval) || 0) * 2000;

  return {
    type: "open_logger",
    sensor: {
      id: sensor.id,
      name: sensor.name || `Logger ${sensor.id}`,
      group: sensor.group || "Không có",
      lat: sensor.lat,
      lng: sensor.lng,
      interval: sensor.interval,
    },
    latest: latest
      ? {
        pressure: getNumber(Number(latest.Pressure) + Number(sensor.adj || 0)),
        flow: getNumber(latest.flow),
        sum: getNumber(latest.sum),
        battery: getNumber(latest.battery),
        createAt: latest.createAt,
        createAtText: formatLocalDateTime(latest.createAt),
        connected: Boolean(latest && latestTime >= onlineAfter),
      }
      : null,
    openPath: `/admin-dashboard/sensors/${encodeURIComponent(sensor.group || "Không có")}`,
  };
};

export const listLoggerPayload = ({ sensors, groupQuery }) => {
  const group = normalizeText(groupQuery);
  const filtered = group
    ? sensors.filter((sensor) => normalizeText(sensor.group || "Không có").includes(group))
    : sensors;

  return {
    type: "logger_list",
    sensors: filtered.slice(0, 30).map((sensor) => ({
      id: sensor.id,
      name: sensor.name || `Logger ${sensor.id}`,
      group: sensor.group || "Không có",
    })),
    total: filtered.length,
  };
};

/* ------------------------------------------------------------------ *
 * Cac cong cu doc du lieu bo sung cho tro ly: tong quan he thong,
 * su co hien truong, canh bao, that thoat DMA va so sanh nhieu logger.
 * ------------------------------------------------------------------ */

const OVERVIEW_LOOKBACK_MS = 7 * 86400000;
const ALERT_PAGE_SIZE = 50;
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

export const findSensorsByIds = ({ sensors, sensorIds }) => {
  const wanted = [...new Set((sensorIds || []).map(Number).filter(Number.isFinite))];
  const byId = new Map(sensors.map((sensor) => [Number(sensor.id), sensor]));
  const found = wanted.map((id) => byId.get(id)).filter(Boolean);
  const missing = wanted.filter((id) => !byId.has(id));
  return { found, missing };
};

// Mot logger duoc coi la con song neu ban tin cuoi con nam trong 2 chu ky gui.
// Chua co interval thi lay moc 1 gio cho an toan.
const isConnected = (sensor, lastAt) => {
  if (!lastAt) return false;
  const intervalMs = (Number(sensor?.interval) || 1800) * 2000;
  return new Date(lastAt).getTime() >= Date.now() - Math.max(intervalMs, 600000);
};

export const buildSystemOverviewPayload = async ({ user, sensors, groupQuery }) => {
  const group = normalizeText(groupQuery);
  const scope = group
    ? sensors.filter((sensor) => normalizeText(sensor.group || "Không có").includes(group))
    : sensors;
  const ids = scope.map((sensor) => Number(sensor.id)).filter(Number.isFinite);

  if (!ids.length) {
    return { type: "system_overview", group: groupQuery || "", stats: null, offline: [], groups: [] };
  }

  const since = new Date(Date.now() - OVERVIEW_LOOKBACK_MS);
  const dayStart = startOfToday();

  const [latestRows, todayRows, openIncidents, todayAlarms] = await Promise.all([
    Sensor.aggregate([
      { $match: { user, index: { $in: ids }, createAt: { $gte: since } } },
      { $sort: { index: 1, createAt: -1 } },
      {
        $group: {
          _id: "$index",
          pressure: { $first: "$Pressure" },
          flow: { $first: "$flow" },
          sum: { $first: "$sum" },
          battery: { $first: "$battery" },
          lastAt: { $first: "$createAt" },
        },
      },
    ]).allowDiskUse(true),
    Sensor.aggregate([
      { $match: { user, index: { $in: ids }, createAt: { $gte: dayStart } } },
      { $sort: { createAt: 1 } },
      { $group: { _id: "$index", firstSum: { $first: "$sum" }, lastSum: { $last: "$sum" } } },
    ]).allowDiskUse(true),
    MapPoint.countDocuments({ user, status: { $ne: "resolved" } }),
    Alarm.countDocuments({ user, createAt: { $gte: dayStart } }),
  ]);

  const latestById = Object.fromEntries(latestRows.map((row) => [Number(row._id), row]));
  const todayById = Object.fromEntries(todayRows.map((row) => [Number(row._id), row]));

  const rows = scope.map((sensor) => {
    const id = Number(sensor.id);
    const latest = latestById[id];
    const today = todayById[id];
    const volume = Number(today?.lastSum ?? 0) - Number(today?.firstSum ?? 0);

    return {
      id,
      name: sensor.name || `Logger ${id}`,
      group: sensor.group || "Không có",
      connected: isConnected(sensor, latest?.lastAt),
      pressure: getNumber(Number(latest?.pressure ?? NaN) + Number(sensor.adj || 0)),
      flow: getNumber(latest?.flow),
      battery: getNumber(latest?.battery),
      lastAt: latest?.lastAt || null,
      lastAtText: latest?.lastAt ? formatLocalDateTime(latest.lastAt) : "Chưa có dữ liệu",
      todayVolume: getNumber(Number.isFinite(volume) && volume > 0 ? volume : 0),
    };
  });

  const offline = rows.filter((row) => !row.connected);
  const byGroup = rows.reduce((result, row) => {
    if (!result[row.group]) result[row.group] = { group: row.group, total: 0, offline: 0, todayVolume: 0 };
    result[row.group].total += 1;
    if (!row.connected) result[row.group].offline += 1;
    result[row.group].todayVolume += Number(row.todayVolume || 0);
    return result;
  }, {});

  return {
    type: "system_overview",
    group: groupQuery || "",
    stats: {
      total: rows.length,
      online: rows.length - offline.length,
      offline: offline.length,
      todayVolume: getNumber(rows.reduce((sum, row) => sum + Number(row.todayVolume || 0), 0)),
      openIncidents,
      todayAlarms,
      generatedAtText: formatLocalDateTime(new Date()),
    },
    offline: offline.slice(0, 20),
    groups: Object.values(byGroup)
      .map((item) => ({ ...item, todayVolume: getNumber(item.todayVolume) }))
      .sort((a, b) => b.offline - a.offline || b.total - a.total),
  };
};

export const buildIncidentPayload = async ({ user, status, sensor, groupQuery, fromDate, toDate }) => {
  const counts = await MapPoint.aggregate([
    { $match: { user } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const statsByStatus = Object.fromEntries(counts.map((row) => [row._id, row.count]));
  const stats = {
    open: statsByStatus.open || 0,
    inProgress: statsByStatus.in_progress || 0,
    resolved: statsByStatus.resolved || 0,
  };

  // Hoi su co quanh mot logger thi dung lai bo loc theo ban kinh da co san.
  if (sensor) {
    const nearby = await findIncidentsNearLoggers({
      user,
      loggerIds: [Number(sensor.id)],
      fromDate,
      toDate,
      radiusMeters: 1000,
    });

    return {
      type: "incident_list",
      stats,
      scope: {
        label: `Quanh ${sensor.name || `Logger ${sensor.id}`} (bán kính 1km)`,
        sensorId: Number(sensor.id),
      },
      incidents: nearby.map((item) => ({
        title: item.title,
        typeLabel: item.type,
        severityLabel: item.severity,
        statusLabel: item.status,
        address: item.address,
        group: item.group,
        note: item.note,
        occurredAtText: item.occurredAt,
        resolvedAtText: item.resolvedAt,
        distanceMeters: item.distanceMeters,
        nearestLoggerName: item.nearestLoggerName,
      })),
      total: nearby.length,
    };
  }

  const query = { user };
  if (status && status !== "all") query.status = status;
  if (groupQuery) query.group = new RegExp(escapeRegex(groupQuery), "i");
  if (fromDate && toDate) query.occurredAt = { $gte: new Date(fromDate), $lte: new Date(toDate) };

  const items = await MapPoint.find(query)
    .select("title type severity status address group note occurredAt resolvedAt lat lng createdByName")
    .sort({ occurredAt: -1 })
    .limit(30)
    .lean();

  const statusLabel = { open: "chưa xử lý", in_progress: "đang xử lý", resolved: "đã xử lý", all: "tất cả" }[status || "open"];

  return {
    type: "incident_list",
    stats,
    scope: {
      label: groupQuery ? `Sự cố ${statusLabel} · khu vực ${groupQuery}` : `Sự cố ${statusLabel}`,
      status: status || "open",
    },
    incidents: items.map((item) => ({
      title: item.title,
      typeLabel: getTypeLabel(item.type),
      severityLabel: getSeverityLabel(item.severity),
      statusLabel: getStatusLabel(item.status),
      severity: item.severity,
      status: item.status,
      address: item.address || "",
      group: item.group || "",
      note: String(item.note || "").slice(0, 300),
      occurredAtText: formatLocalDateTime(item.occurredAt),
      resolvedAtText: item.resolvedAt ? formatLocalDateTime(item.resolvedAt) : "",
      createdByName: item.createdByName || "",
      lat: item.lat,
      lng: item.lng,
    })),
    total: items.length,
  };
};

export const buildAlertPayload = async ({ user, groupQuery, fromDate, toDate }) => {
  const start = fromDate ? new Date(fromDate) : startOfToday();
  const end = toDate ? new Date(toDate) : endOfToday();

  const query = { user, createAt: { $gte: start, $lte: end } };
  if (groupQuery) query.group = new RegExp(escapeRegex(groupQuery), "i");

  // Dem rieng: neu chi dem theo mang da cat thi luc nao cung bao dung bang gioi han.
  const [items, total] = await Promise.all([
    Alarm.find(query)
      .select("message name sensorId sensorName group type level value createAt -_id")
      .sort({ createAt: -1 })
      .limit(ALERT_PAGE_SIZE)
      .lean(),
    Alarm.countDocuments(query),
  ]);

  const bySensor = items.reduce((result, item) => {
    const key = item.sensorName || item.sensorId || "Khác";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  return {
    type: "alert_list",
    range: { fromText: formatLocalDateTime(start), toText: formatLocalDateTime(end) },
    group: groupQuery || "",
    total,
    shown: items.length,
    truncated: total > items.length,
    topSensors: Object.entries(bySensor)
      .map(([name, count]) => ({ name: String(name), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    alerts: items.map((item) => ({
      message: item.message || item.name || "Cảnh báo",
      sensorId: item.sensorId ?? null,
      sensorName: item.sensorName || "",
      group: item.group || "Không có",
      level: item.level || item.type || "warning",
      value: getNumber(item.value),
      createAtText: formatLocalDateTime(item.createAt),
    })),
  };
};

const compactDmaNode = (node, depth = 0) => ({
  name: node.name,
  group: node.group || "",
  inletTotal: getNumber(node.inletTotal),
  consumeTotal: getNumber(node.consumeTotal),
  accountedTotal: getNumber(node.accountedTotal),
  loss: getNumber(node.loss),
  lossRate: getNumber(node.lossRate),
  mnf: getNumber(node.mnf),
  children: depth >= 2 ? [] : (node.children || []).map((child) => compactDmaNode(child, depth + 1)),
});

export const buildDmaLossPayload = async ({ user, dmaQuery, fromDate, toDate }) => {
  const { dma, dmas } = await findDmaByQuery({ user, dmaQuery });

  if (!dma) {
    return {
      type: "dma_candidates",
      dmas: dmas.slice(0, 20).map((item) => ({ id: String(item._id), name: item.name, group: item.group || "" })),
      total: dmas.length,
    };
  }

  const result = await calculateDmaResult({ user, dma, fromDate, toDate });

  return {
    type: "dma_loss",
    dma: { id: String(dma._id), name: dma.name, group: dma.group || "", description: dma.description || "" },
    range: { fromText: formatLocalDateTime(fromDate), toText: formatLocalDateTime(toDate) },
    summary: {
      inletTotal: getNumber(result.inletTotal),
      consumeTotal: getNumber(result.consumeTotal),
      childInletTotal: getNumber(result.childInletTotal),
      accountedTotal: getNumber(result.accountedTotal),
      loss: getNumber(result.loss),
      lossRate: getNumber(result.lossRate),
      mnf: getNumber(result.mnf),
    },
    inlets: (result.inlets || []).map((item) => ({
      id: item.id,
      name: item.name,
      volume: getNumber(item.volume),
      minFlow: getNumber(item.minFlow),
      avgFlow: getNumber(item.avgFlow),
      hasData: item.hasData,
    })),
    consumes: (result.consumes || []).map((item) => ({
      id: item.id,
      name: item.name,
      volume: getNumber(item.volume),
      minFlow: getNumber(item.minFlow),
      avgFlow: getNumber(item.avgFlow),
      hasData: item.hasData,
    })),
    children: (result.children || []).map((child) => compactDmaNode(child)),
    openPath: "/admin-dashboard/dma-loss",
  };
};

export const buildComparePayload = (reportData) => ({
  type: "logger_compare",
  reportData,
  summary: {
    loggerCount: reportData.series.length,
    fromDate: formatLocalDateTime(reportData.fromDate),
    toDate: formatLocalDateTime(reportData.toDate),
    totalVolume: getNumber(
      reportData.series.reduce((sum, item) => sum + Number(item.flowStats?.volume || 0), 0)
    ),
  },
  rows: reportData.series.map((item) => ({
    id: item.id,
    name: item.name,
    group: item.group,
    pressureAvg: getNumber(item.pressureStats?.avg),
    pressureMin: getNumber(item.pressureStats?.min),
    pressureMax: getNumber(item.pressureStats?.max),
    flowAvg: getNumber(item.flowStats?.avg),
    flowMax: getNumber(item.flowStats?.max),
    volume: getNumber(item.flowStats?.volume),
  })),
});
