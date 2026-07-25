import Sensor from "../models/Sensor.js"
import InfoSen from "../models/Info.js";
import Group from "../models/Group.js";
import Alarm from "../models/AlarmFlow.js"
import DnpConfig from "../models/DnpConfig.js";
import HomeMessage from "../models/HomeMessage.js";
import ExcelJS from 'exceljs';
import axios from "axios";
import { client } from "../mqtt/mqtt.js";
import cron from 'node-cron'
import { differenceInCalendarDays } from 'date-fns'
import { clientRedis } from "../mqtt/redis.js";
import { acquireAiUsage, releaseAiUsage, respondAiLimit } from "../utils/aiUsage.js";

const scheduledJobs = {};
// const userGlobal = [0];

// cron.schedule('1 0 * * *', () => {

// });

// function runYourFunction() {
//   // Code của bạn ở đây
//   console.log('Đang thực hiện công việc...');
// }

function timeToCronExpr(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return `${minute} ${hour} * * *`;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// export const fetchTimeAlarm = async (user, id) => {
//   const data = await Alarm.find({ user: user, id: id });
//   const now = new Date();
//   const nowMinutes = now.getHours() * 60 + now.getMinutes();

//   let closest = null;
//   let maxMinutes = -1;
//   data.forEach((item) => {
//     const itemMinutes = timeToMinutes(item.time);
//     if (itemMinutes <= nowMinutes && itemMinutes > maxMinutes) {
//       maxMinutes = itemMinutes;
//       closest = item;
//     }
//   })
//   if (closest) {
//     publishMessage("high_threshold", closest.flow * 1000, closest.id)
//   }
// }

// const publishMessage = (type, message, sen_id) => {
//   // console.log(JSON.stringify({n:sen_id,m:type,d:message}))
//   client.publish(
//     'lg/rec',
//     JSON.stringify({ n: sen_id, m: type, d: message }),
//     { qos: 2 },
//     (error) => {
//       if (error) {
//         return false
//       } else {
//         return true
//       }
//     }
//   )
// }

const LOGGER_CONFIG_TTL_SECONDS = 24 * 60 * 60;
const getLoggerConfigPendingKey = (requestId) => `loggerConfig:pending:${requestId}`;
const getLoggerConfigActiveKey = (user, sensorId) => `loggerConfig:active:${Number(user) || 0}:${Number(sensorId)}`;
const createLoggerConfigRequestId = (sensorId) => `${Number(sensorId)}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const LOGGER_CONFIG_ACTION_BY_COMMAND = {
  1: "interval",
  2: "sample",
  3: "temp",
  4: "unit",
  5: "upTime",
  6: "alertTimes",
  7: "highAlerts",
  8: "lowAlerts",
  9: "flowHighs",
  10: "flowLows",
  11: "onP",
  12: "onF",
  14: "sum",
};

const getLoggerConfigActionKey = (status) => (
  status?.actionKey || LOGGER_CONFIG_ACTION_BY_COMMAND[Number(status?.command?.m)] || null
);

const parseLoggerConfigActiveRequestIds = (rawValue) => {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch (error) {
    // Backward compatible with the previous single-request string value.
  }
  return [String(rawValue)].filter(Boolean);
};

const saveLoggerConfigActiveRequestIds = async (user, sensorId, requestIds) => {
  const activeKey = getLoggerConfigActiveKey(user, sensorId);
  const uniqueRequestIds = [...new Set(requestIds.map(String).filter(Boolean))];
  if (uniqueRequestIds.length === 0) {
    await clientRedis.del(activeKey);
    return;
  }

  await clientRedis.set(
    activeKey,
    JSON.stringify(uniqueRequestIds),
    { EX: LOGGER_CONFIG_TTL_SECONDS }
  );
};

const appendLoggerConfigActiveRequest = async (user, sensorId, requestId) => {
  const activeKey = getLoggerConfigActiveKey(user, sensorId);
  const currentRequestIds = parseLoggerConfigActiveRequestIds(await clientRedis.get(activeKey));
  await saveLoggerConfigActiveRequestIds(user, sensorId, [...currentRequestIds, requestId]);
};

const removeLoggerConfigActiveRequest = async (user, sensorId, requestId) => {
  const activeKey = getLoggerConfigActiveKey(user, sensorId);
  const currentRequestIds = parseLoggerConfigActiveRequestIds(await clientRedis.get(activeKey));
  await saveLoggerConfigActiveRequestIds(
    user,
    sensorId,
    currentRequestIds.filter((item) => item !== requestId)
  );
};

const publishMessage = async (type, message, sen_id, user = 0, update = null, actionKey = null) => {
  const sensorId = Number(sen_id)
  const numericUser = Number(user) || 0
  const publishTopic = `logger/${sensorId}`
  const requestId = createLoggerConfigRequestId(sensorId)
  const pendingPayload = {
    requestId,
    status: "pending",
    user: numericUser,
    sensorId,
    actionKey: actionKey || LOGGER_CONFIG_ACTION_BY_COMMAND[Number(type)] || null,
    command: { m: type, d: message },
    update,
    sentAt: new Date().toISOString(),
  }

  if (!client || !client.connected || !Number.isFinite(sensorId)) {
    return { ok: false, error: "MQTT chưa kết nối hoặc ID logger không hợp lệ" }
  }

  await clientRedis.set(
    getLoggerConfigPendingKey(requestId),
    JSON.stringify(pendingPayload),
    { EX: LOGGER_CONFIG_TTL_SECONDS }
  )
  await appendLoggerConfigActiveRequest(numericUser, sensorId, requestId)

  return new Promise((resolve) => {
    client.publish(
      publishTopic,
      JSON.stringify({ n: sensorId, m: type, d: message }),
      { qos: 2 },
      async (publishError) => {
        if (publishError) {
          await clientRedis.del(getLoggerConfigPendingKey(requestId))
          await removeLoggerConfigActiveRequest(numericUser, sensorId, requestId)
          return resolve({ ok: false, error: publishError.message })
        }

        return resolve({ ok: true, pending: true, requestId, actionKey: pendingPayload.actionKey })
      }
    )
  })
}

const sendConfigPendingResponse = (res, result, extra = {}) => {
  if (!result.ok) {
    return res.status(500).json({
      success: false,
      error: result.error || "Không gửi được cấu hình MQTT",
    })
  }

  return res.status(202).json({
    success: true,
    pending: true,
    status: "pending",
    requestId: result.requestId,
    actionKey: result.actionKey || null,
    message: "Đã gửi cấu hình tới logger, đang chờ logger phản hồi",
    ...extra,
  })
}

const readLoggerConfigStatus = async (requestId) => {
  const rawStatus = await clientRedis.get(getLoggerConfigPendingKey(requestId))
  if (!rawStatus) return null
  try {
    const status = JSON.parse(rawStatus)
    return {
      ...status,
      actionKey: getLoggerConfigActionKey(status),
    }
  } catch (error) {
    return null
  }
}

const toLoggerConfigStatusResponse = (status) => ({
  status: status.status || "pending",
  pending: status.status !== "acknowledged",
  acknowledged: status.status === "acknowledged",
  requestId: status.requestId,
  sensorId: status.sensorId,
  actionKey: getLoggerConfigActionKey(status),
  sentAt: status.sentAt,
  acknowledgedAt: status.acknowledgedAt || null,
});

export const getLoggerConfigStatus = async (req, res) => {
  try {
    const requestId = String(req.query.requestId || "").trim()
    const sensorId = Number(req.query.sensorId)
    const user = Number(req.query.user) || 0

    if (requestId) {
      const status = await readLoggerConfigStatus(requestId)
      if (!status) {
        return res.status(404).json({ success: false, error: "Không tìm thấy trạng thái cấu hình hoặc đã quá hạn" })
      }

      return res.status(200).json({
        success: true,
        ...toLoggerConfigStatusResponse(status),
      })
    }

    if (!Number.isFinite(sensorId)) {
      return res.status(400).json({ success: false, error: "Thiếu requestId cấu hình" })
    }

    const requestIds = parseLoggerConfigActiveRequestIds(
      await clientRedis.get(getLoggerConfigActiveKey(user, sensorId))
    )
    const statuses = await Promise.all(requestIds.map(readLoggerConfigStatus))
    const items = statuses
      .filter(Boolean)
      .filter((status) => status.status !== "acknowledged")
      .map(toLoggerConfigStatusResponse)

    return res.status(200).json({
      success: true,
      sensorId,
      items,
      pendingActions: [...new Set(items.map((item) => item.actionKey).filter(Boolean))],
    })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không kiểm tra được trạng thái cấu hình" })
  }
}



function addDateElement(dataArray, sensor, index, type) {
  if (dataArray[index]) {
    dataArray[index] = (dataArray[index] + sensor[type]) / 2
  }
  else {
    dataArray[index] = sensor[type]
  }
}

function convertTime(timeConvert, watch) {
  timeConvert = new Date(timeConvert)
  return (timeConvert.getHours() * 60 + timeConvert.getMinutes()) * 60 / watch
}


function getDatesInRange(startDate, endDate) {
  const dateArray = [];
  let currentDate = new Date(startDate);

  while (differenceInCalendarDays(endDate, currentDate)) {
    dateArray.push(new Date(currentDate)); // YYYY-MM-DD
    currentDate.setDate(currentDate.getDate() + 1);
  }
  dateArray.push(endDate);
  return dateArray;
}

function getLength(lengModal, listDate) {
  const lengDate = listDate.length;
  const minute_s = listDate[0].getMinutes();
  const minute_e = listDate[lengDate - 1].getMinutes();
  if (lengDate !== 1) {
    return lengModal * lengDate - lengModal * 2 + (24 - listDate[0].getHours() + listDate[lengDate - 1].getHours()) * 12 + Math.floor((minute_e - minute_s) / 5)
  }
  else {
    return (listDate[lengDate - 1].getHours() - listDate[0].getHours()) * 12 + Math.floor((minute_e - minute_s) / 5)
  }
}

const parseHourMinute = (value, fallback) => {
  const [hour, minute] = String(value || fallback).split(":").map(Number);
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
};

const toMinutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();

const getProductionVolume = async ({ user, id, start, end }) => {
  if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return 0;
  }

  const rows = await Sensor.find({
    user,
    index: id,
    createAt: { $gte: start, $lte: end },
    sum: { $ne: null },
  })
    .select("sum createAt -_id")
    .sort({ createAt: 1 })
    .lean();

  if (rows.length < 2) return 0;
  const volume = Number(rows[rows.length - 1].sum) - Number(rows[0].sum);
  return Number.isFinite(volume) && volume > 0 ? volume : 0;
};

const reportMetricMap = {
  pressure: {
    field: "avgPressure",
    label: "Áp suất",
    unit: "m",
  },
  flow: {
    field: "avgFlow",
    label: "Lưu lượng",
    unit: "m³/h",
  },
  meter: {
    field: "lastSum",
    label: "Chỉ số đồng hồ",
    unit: "m³",
  },
};

const normalizeReportIds = (ids) => [...new Set((ids || []).map(Number).filter((id) => Number.isFinite(id)))];

const getBucketLabels = ({ start, end, intervalMs }) => {
  const labels = [];
  const firstBucket = Math.floor(start.getTime() / intervalMs) * intervalMs;
  for (let time = firstBucket; time <= end.getTime(); time += intervalMs) {
    labels.push(new Date(time).toISOString());
  }
  return labels;
};

const getDashboardUserNumber = (req) => {
  const bodyUser = Number(req.body?.user);
  const queryUser = Number(req.query?.user);
  if (Number.isFinite(bodyUser)) return bodyUser;
  if (Number.isFinite(queryUser)) return queryUser;
  return Number(req.user?.user ?? 0);
};

const normalizeMessageText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

export const getHomeMessages = async (req, res) => {
  try {
    const user = getDashboardUserNumber(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);
    const messages = await HomeMessage.find({ user })
      .select("sender message createdByName createAt")
      .sort({ createAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không tải được tin nhắn trang chủ" });
  }
};

export const createHomeMessage = async (req, res) => {
  try {
    const user = getDashboardUserNumber(req);
    const sender = normalizeMessageText(req.body.sender || req.user?.name || "Người gửi", 80);
    const message = normalizeMessageText(req.body.message, 1000);

    if (!sender) {
      return res.status(400).json({ success: false, error: "Vui lòng nhập người gửi" });
    }
    if (!message) {
      return res.status(400).json({ success: false, error: "Vui lòng nhập nội dung thông báo" });
    }

    const created = await HomeMessage.create({
      user,
      sender,
      message,
      createdBy: req.user?._id,
      createdByName: req.user?.name,
    });

    return res.status(201).json({ success: true, message: created });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không gửi được tin nhắn trang chủ" });
  }
};

export const deleteHomeMessage = async (req, res) => {
  try {
    const user = getDashboardUserNumber(req);
    const { id } = req.params;
    const deleted = await HomeMessage.findOneAndDelete({ _id: id, user }).lean();

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Không tìm thấy tin nhắn cần xoá" });
    }

    return res.status(200).json({ success: true, id });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không xoá được tin nhắn trang chủ" });
  }
};

export const getTodayWarningHistory = async (req, res) => {
  try {
    const requestUser = Number(req.query.user ?? req.body?.user);
    const numericUser = Number.isFinite(requestUser) ? requestUser : Number(req.user?.user ?? 0);
    const group = String(req.query.group || "").trim();
    const requestedDate = String(req.query.date || "").trim();
    const start = requestedDate ? new Date(`${requestedDate}T00:00:00`) : new Date();
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, error: "Ngày xem lịch sử không hợp lệ" });
    }
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    if (!Number.isFinite(numericUser)) {
      return res.status(400).json({ success: false, error: "User không hợp lệ" });
    }

    const query = group
      ? {
        user: numericUser,
        group,
        createAt: { $gte: start, $lt: end },
      }
      : {
        $or: [{ user: numericUser }, { user: { $exists: false } }],
        createAt: { $gte: start, $lt: end },
      };

    const [histories, sensorInfos] = await Promise.all([
      Alarm.find(query)
        .select("name message user sensorId sensorName group type level value createAt -_id")
        .sort({ createAt: -1 })
        .skip(skip)
        .limit(limit + 1)
        .lean(),
      InfoSen.find({ user: numericUser }).select("id name group -_id").lean(),
    ]);
    const pageHistories = histories.slice(0, limit);

    return res.status(200).json({
      success: true,
      hasMore: histories.length > limit,
      nextSkip: skip + pageHistories.length,
      date: start.toLocaleDateString("sv-SE"),
      histories: pageHistories.map((item) => ({
        ...(() => {
          const message = item.message || item.name || "Cảnh báo";
          const matchedInfo = item.sensorId
            ? sensorInfos.find((sensor) => Number(sensor.id) === Number(item.sensorId))
            : sensorInfos.find((sensor) => sensor.name && message.includes(sensor.name));
          return {
            ...item,
            message,
            sensorId: item.sensorId ?? matchedInfo?.id,
            sensorName: item.sensorName || matchedInfo?.name,
            group: item.group || matchedInfo?.group || "Không có",
          };
        })(),
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không lấy được lịch sử cảnh báo" });
  }
};

export const getSensorReport = async (req, res) => {
  try {
    const {
      loggerIds = [],
      fromDate,
      toDate,
      user,
      metric = "flow",
    } = req.body;
    const ids = normalizeReportIds(loggerIds).slice(0, 80);
    const requestUser = Number(user);
    const numericUser = Number.isFinite(requestUser) ? requestUser : Number(req.user?.user ?? 0);
    const selectedMetric = reportMetricMap[metric] ? metric : "flow";
    const intervalMinutes = Math.min(Math.max(Number(req.body.intervalMinutes) || 60, 5), 1440);
    const intervalMs = intervalMinutes * 60 * 1000;
    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (!ids.length) {
      return res.status(400).json({ success: false, error: "Chưa chọn logger" });
    }
    if (!Number.isFinite(numericUser)) {
      return res.status(400).json({ success: false, error: "User không hợp lệ" });
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return res.status(400).json({ success: false, error: "Khoảng thời gian không hợp lệ" });
    }

    const labels = getBucketLabels({ start, end, intervalMs });
    if (labels.length > 3500) {
      return res.status(400).json({
        success: false,
        error: "Khoảng thời gian quá dài so với bước thời gian. Hãy tăng interval hoặc thu hẹp thời gian.",
      });
    }

    const [infos, buckets, stats] = await Promise.all([
      InfoSen.find({ user: numericUser, id: { $in: ids } }).select("id name group adj").lean(),
      Sensor.aggregate([
        {
          $match: {
            user: numericUser,
            index: { $in: ids },
            createAt: { $gte: start, $lte: end },
          },
        },
        { $sort: { createAt: 1 } },
        {
          $addFields: {
            bucketTime: {
              $toDate: {
                $subtract: [
                  { $toLong: "$createAt" },
                  { $mod: [{ $toLong: "$createAt" }, intervalMs] },
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
            firstSum: { $first: "$sum" },
            lastSum: { $last: "$sum" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.bucket": 1 } },
      ]),
      Sensor.aggregate([
        {
          $match: {
            user: numericUser,
            index: { $in: ids },
            createAt: { $gte: start, $lte: end },
          },
        },
        { $sort: { createAt: 1 } },
        {
          $group: {
            _id: "$index",
            firstSum: { $first: "$sum" },
            lastSum: { $last: "$sum" },
            minPressure: { $min: "$Pressure" },
            avgPressure: { $avg: "$Pressure" },
            maxPressure: { $max: "$Pressure" },
            minFlow: { $min: "$flow" },
            avgFlow: { $avg: "$flow" },
            maxFlow: { $max: "$flow" },
            firstAt: { $first: "$createAt" },
            lastAt: { $last: "$createAt" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const infoById = Object.fromEntries(infos.map((info) => [info.id, info]));
    const statById = Object.fromEntries(stats.map((item) => [item._id, item]));
    const bucketByLogger = buckets.reduce((map, item) => {
      const loggerId = Number(item._id.index);
      const label = item._id.bucket.toISOString();
      if (!map[loggerId]) map[loggerId] = {};
      const info = infoById[loggerId] || {};
      const rawValue = item[reportMetricMap[selectedMetric].field];
      map[loggerId][label] = selectedMetric === "pressure" && Number.isFinite(Number(rawValue))
        ? Number(rawValue) + Number(info.adj || 0)
        : rawValue;
      return map;
    }, {});

    const series = ids.map((id) => {
      const info = infoById[id] || {};
      const stat = statById[id];
      const values = labels.map((label) => {
        const value = bucketByLogger[id]?.[label];
        return Number.isFinite(Number(value)) ? Number(value) : null;
      });
      const realValues = values.filter((value) => Number.isFinite(value));
      const rawVolume = Number(stat?.lastSum ?? 0) - Number(stat?.firstSum ?? 0);
      return {
        id,
        name: info.name || `Logger ${id}`,
        group: info.group || "Không có",
        values,
        stats: {
          min: realValues.length ? Math.min(...realValues) : null,
          max: realValues.length ? Math.max(...realValues) : null,
          avg: realValues.length ? realValues.reduce((sum, value) => sum + value, 0) / realValues.length : null,
          count: stat?.count || 0,
          volume: Number.isFinite(rawVolume) && rawVolume > 0 ? rawVolume : 0,
          firstAt: stat?.firstAt || null,
          lastAt: stat?.lastAt || null,
        },
      };
    });

    return res.status(200).json({
      success: true,
      labels,
      series,
      metric: {
        key: selectedMetric,
        ...reportMetricMap[selectedMetric],
      },
      intervalMinutes,
      fromDate: start,
      toDate: end,
    });
  } catch (error) {
    console.error("Không lấy được dữ liệu báo cáo:", error);
    return res.status(500).json({ success: false, error: "Không lấy được dữ liệu báo cáo" });
  }
};

const getAiNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
};

const getEvenSamples = (labels = [], series = [], maxPoints = 16) => {
  const length = Math.min(labels.length, series.length);
  if (!length) return [];
  const step = Math.max(Math.ceil(length / maxPoints), 1);
  const samples = [];
  for (let index = 0; index < length; index += step) {
    samples.push({
      time: labels[index],
      value: getAiNumber(series[index]),
    });
  }
  const lastIndex = length - 1;
  if (samples[samples.length - 1]?.time !== labels[lastIndex]) {
    samples.push({ time: labels[lastIndex], value: getAiNumber(series[lastIndex]) });
  }
  return samples;
};

const getCombinedSamples = (labels = [], pressureValues = [], flowValues = [], maxPoints = 16) => {
  const length = Math.min(labels.length, Math.max(pressureValues.length, flowValues.length));
  if (!length) return [];
  const step = Math.max(Math.ceil(length / maxPoints), 1);
  const samples = [];
  for (let index = 0; index < length; index += step) {
    samples.push({
      time: labels[index],
      pressure: getAiNumber(pressureValues[index]),
      flow: getAiNumber(flowValues[index]),
    });
  }
  const lastIndex = length - 1;
  if (samples[samples.length - 1]?.time !== labels[lastIndex]) {
    samples.push({
      time: labels[lastIndex],
      pressure: getAiNumber(pressureValues[lastIndex]),
      flow: getAiNumber(flowValues[lastIndex]),
    });
  }
  return samples;
};

const compactStats = (stats = {}) => ({
  min: getAiNumber(stats.min),
  avg: getAiNumber(stats.avg),
  max: getAiNumber(stats.max),
  volume: getAiNumber(stats.volume),
  count: Number(stats.count || 0),
});

const buildBusinessSummary = (compactSeries, isCombined) => {
  const volumeItems = compactSeries.map((item) => {
    const stats = isCombined ? item.flowStats : item.stats;
    return {
      id: item.id,
      name: item.name,
      group: item.group,
      volume: getAiNumber(stats?.volume),
      count: Number(stats?.count || 0),
    };
  });
  const itemsWithVolume = volumeItems.filter((item) => item.volume !== null);
  const totalVolume = getAiNumber(itemsWithVolume.reduce((sum, item) => sum + Number(item.volume || 0), 0));
  const averageVolume = itemsWithVolume.length ? getAiNumber(Number(totalVolume || 0) / itemsWithVolume.length) : null;
  const sortedByVolume = [...itemsWithVolume].sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0));

  return {
    totalVolume,
    averageVolumePerLogger: averageVolume,
    loggerCount: compactSeries.length,
    loggersWithData: itemsWithVolume.filter((item) => item.count > 0).length,
    noDataLoggers: volumeItems.filter((item) => item.count === 0).map((item) => ({
      id: item.id,
      name: item.name,
      group: item.group,
    })),
    topVolumeLoggers: sortedByVolume.slice(0, 5),
    lowVolumeLoggers: sortedByVolume.slice(-5).reverse(),
  };
};

const buildReportAnalysisPrompt = ({ reportData, context }) => {
  const labels = Array.isArray(reportData?.labels) ? reportData.labels : [];
  const series = Array.isArray(reportData?.series) ? reportData.series.slice(0, 40) : [];
  const isCombined = reportData?.metric?.key === "pressureFlow";
  const compactSeries = series.map((item) => {
    const base = {
      id: item.id,
      name: item.name,
      group: item.group || "Không có",
    };
    if (isCombined) {
      return {
        ...base,
        pressureStats: compactStats(item.pressureStats),
        flowStats: compactStats(item.flowStats),
        samples: getCombinedSamples(labels, item.pressureValues || [], item.flowValues || []),
      };
    }
    return {
      ...base,
      stats: compactStats(item.stats),
      samples: getEvenSamples(labels, item.values || []),
    };
  });
  const businessSummary = buildBusinessSummary(compactSeries, isCombined);

  return `Bạn là chuyên gia phân tích vận hành hệ thống cấp nước và datalogger.
Hãy viết báo cáo AI theo đúng format chung dưới đây, bằng tiếng Việt, ngắn gọn, rõ hành động.

FORMAT BẮT BUỘC:
## 1. Tình hình kinh doanh dựa trên sản lượng
- Tổng sản lượng trong kỳ: nêu số m³ nếu có.
- Nhận định kinh doanh: sản lượng đang tập trung ở logger/nhóm nào, logger nào thấp hoặc không có dữ liệu.
- Tác động: nêu nguy cơ thất thu, bất thường tiêu thụ, hoặc điểm cần đối soát nếu có.

## 2. Tình hình vận hành kỹ thuật
- Tóm tắt xu hướng áp suất/lưu lượng/chỉ số theo dữ liệu đang xem.
- Nêu logger ổn định và logger dao động mạnh nếu thấy trong dữ liệu.

## 3. Bất thường và rủi ro
- Liệt kê các logger thiếu dữ liệu, sản lượng bằng 0, lưu lượng/áp suất bất thường.
- Nếu chưa đủ dữ liệu để kết luận, ghi rõ "chưa đủ dữ liệu".

## 4. Đề xuất xử lý
- Đưa các bước kiểm tra thực địa/đối soát dữ liệu theo thứ tự ưu tiên.

## 5. Kết luận nhanh
- Viết 2-3 câu chốt lại tình hình chính.

QUY TẮC:
- Không bịa số liệu ngoài dữ liệu JSON.
- Không viết quá dài.
- Ưu tiên phân tích sản lượng cho phần kinh doanh.
- Nếu thiếu dữ liệu, nói thẳng là chưa đủ dữ liệu.

Ngữ cảnh báo cáo:
${JSON.stringify({
    fromDate: context?.fromDate,
    toDate: context?.toDate,
    intervalMinutes: context?.intervalMinutes,
    sourceMode: context?.sourceMode,
    metric: reportData?.metric || context?.metric,
    labelsCount: labels.length,
    totalSeries: Array.isArray(reportData?.series) ? reportData.series.length : 0,
    analyzedSeries: compactSeries.length,
    truncatedSeries: Array.isArray(reportData?.series) && reportData.series.length > compactSeries.length,
    businessSummary,
  }, null, 2)}

Dữ liệu logger đã rút gọn:
${JSON.stringify(compactSeries, null, 2)}`;
};

export const analyzeSensorReport = async (req, res) => {
  let aiUsage;
  try {
    const { reportData, context = {} } = req.body;
    if (!reportData || !Array.isArray(reportData.labels) || !Array.isArray(reportData.series) || !reportData.series.length) {
      return res.status(400).json({ success: false, error: "Chưa có dữ liệu báo cáo để phân tích" });
    }

    aiUsage = await acquireAiUsage(req);
    const baseUrl = (process.env.GEMINI_WEB2API_BASE_URL || "http://127.0.0.1:8081/v1").replace(/\/+$/, "");
    const model = process.env.GEMINI_WEB2API_MODEL || "gemini-3.5-flash";
    const apiKey = process.env.GEMINI_WEB2API_API_KEY || "sk-gemini";
    const timeout = Number(process.env.GEMINI_WEB2API_TIMEOUT_MS) || 120000;
    const prompt = buildReportAnalysisPrompt({ reportData, context });

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [
          {
            role: "system",
            content: "Bạn phân tích dữ liệu kỹ thuật cấp nước. Trả lời bằng tiếng Việt, súc tích, ưu tiên phát hiện bất thường và khuyến nghị vận hành.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        stream: false,
      },
      {
        timeout,
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      }
    );

    const analysis = response.data?.choices?.[0]?.message?.content?.trim();
    if (!analysis) {
      await releaseAiUsage(aiUsage).catch((releaseError) => {
        console.error("Không hoàn lại lượt AI báo cáo:", releaseError.message);
      });
      aiUsage = null;
      return res.status(502).json({ success: false, error: "AI không trả về nội dung phân tích" });
    }

    return res.status(200).json({ success: true, analysis, model, aiUsage });
  } catch (error) {
    if (error?.statusCode === 429) return respondAiLimit(res, error);
    if (aiUsage) await releaseAiUsage(aiUsage).catch((releaseError) => {
      console.error("Không hoàn lại lượt AI báo cáo:", releaseError.message);
    });
    const code = error?.code || error?.cause?.code;
    const upstreamMessage = error.response?.data?.error?.message || error.response?.data?.message;
    if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
      return res.status(503).json({
        success: false,
        error: "AI service chưa chạy hoặc backend chưa kết nối được gemini-web2api",
      });
    }
    console.error("Không phân tích được báo cáo bằng AI:", upstreamMessage || error.message);
    return res.status(500).json({
      success: false,
      error: upstreamMessage || "Không phân tích được báo cáo bằng AI",
    });
  }
};

const toLocalDateOnly = (value) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const addLocalDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatReportDay = (date) => `${date.getDate()}/${date.getMonth() + 1}`;

const formatReportMonth = (date) => `${date.getMonth() + 1}/${date.getFullYear()}`;

const makeDailyWindow = ({ reportDay, startHour, endHour }) => {
  const startTime = parseHourMinute(startHour, "00:00");
  const endTime = parseHourMinute(endHour, "00:00");
  const start = new Date(reportDay);
  start.setHours(startTime.hour, startTime.minute, 0, 0);
  const end = addLocalDays(reportDay, 1);
  end.setHours(endTime.hour, endTime.minute, 0, 0);
  return { start, end };
};

const lowerBoundByTime = (rows, targetMs) => {
  let left = 0;
  let right = rows.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (new Date(rows[mid].createAt).getTime() < targetMs) left = mid + 1;
    else right = mid;
  }
  return left;
};

const getRowsInWindow = (rows, start, end) => {
  const startIndex = lowerBoundByTime(rows, start.getTime());
  const endIndex = lowerBoundByTime(rows, end.getTime() + 1);
  return rows.slice(startIndex, endIndex);
};

const toSafeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const roundReportNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
};

const getDailyLoggerMetric = (rows, start, end) => {
  const windowRows = getRowsInWindow(rows, start, end);
  if (windowRows.length < 2) {
    return { volume: 0, minFlow: null, count: windowRows.length };
  }

  const firstSum = toSafeNumber(windowRows[0].sum);
  const lastSum = toSafeNumber(windowRows[windowRows.length - 1].sum);
  const rawVolume = firstSum !== null && lastSum !== null ? lastSum - firstSum : 0;
  const flowValues = windowRows.map((row) => toSafeNumber(row.flow)).filter((value) => value !== null);

  return {
    volume: Number.isFinite(rawVolume) && rawVolume > 0 ? roundReportNumber(rawVolume) : 0,
    minFlow: flowValues.length ? roundReportNumber(Math.min(...flowValues)) : null,
    count: windowRows.length,
  };
};

const setCellBorder = (cell) => {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
};

const applyDeltaCellStyle = (cell) => {
  const value = Number(cell.value);
  if (!Number.isFinite(value) || value === 0) return;
  cell.font = {
    ...(cell.font || {}),
    bold: true,
    color: { argb: value > 0 ? "FF16A34A" : "FFDC2626" },
  };
};

const formatDnpSheetNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const rounded = roundReportNumber(number);
  const [integerPart, decimalPart = ""] = String(rounded).split(".");
  const integerText = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimalPart ? `${integerText},${decimalPart}` : integerText;
};

const appendDnpMonthlyAverageSheet = async (workbook, { user }) => {
  const worksheet = workbook.addWorksheet("BQ DNP");
  const years = Array.from({ length: 4 }, (_, index) => new Date().getFullYear() - 3 + index);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const config = await DnpConfig.findOne({ user }).lean();
  const dnpLoggerIds = [...new Set((config?.loggerIds || []).map(Number).filter(Number.isFinite))];

  worksheet.mergeCells(1, 1, 1, years.length + 1);
  worksheet.getCell(1, 1).value = "Tổng sản lượng lấy nước DNP hàng tháng trong năm";
  worksheet.mergeCells(2, 1, 2, years.length + 1);
  worksheet.getCell(2, 1).value = "(Số liệu dựa trên Datalogger báo)";

  [1, 2].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, size: rowNumber === 1 ? 14 : 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  });

  if (!dnpLoggerIds.length) {
    worksheet.mergeCells(4, 1, 4, years.length + 1);
    worksheet.getCell(4, 1).value = "Chưa cấu hình logger DNP";
    worksheet.getCell(4, 1).font = { bold: true, color: { argb: "FFB91C1C" } };
    worksheet.getCell(4, 1).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.columns = [{ width: 16 }, ...years.map(() => ({ width: 16 }))];
    return;
  }

  const startDate = new Date(years[0], 0, 1, 0, 0, 0, 0);
  const endDate = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
  const monthlyRows = await Sensor.aggregate([
    {
      $match: {
        user,
        index: { $in: dnpLoggerIds },
        createAt: { $gte: startDate, $lt: endDate },
        sum: { $ne: null },
      },
    },
    { $sort: { index: 1, createAt: 1 } },
    {
      $group: {
        _id: {
          index: "$index",
          year: { $year: { date: "$createAt", timezone: "Asia/Ho_Chi_Minh" } },
          month: { $month: { date: "$createAt", timezone: "Asia/Ho_Chi_Minh" } },
        },
        firstSum: { $first: "$sum" },
        lastSum: { $last: "$sum" },
      },
    },
    {
      $project: {
        _id: 0,
        year: "$_id.year",
        month: "$_id.month",
        volume: { $subtract: ["$lastSum", "$firstSum"] },
      },
    },
  ]);

  const totalByMonth = monthlyRows.reduce((map, row) => {
    const volume = Number(row.volume);
    if (!Number.isFinite(volume) || volume <= 0) return map;
    const key = `${row.year}-${row.month}`;
    map[key] = (map[key] || 0) + volume;
    return map;
  }, {});

  const valuesByYear = Object.fromEntries(years.map((year) => [year, Array(12).fill(null)]));
  years.forEach((year) => {
    for (let month = 1; month <= 12; month += 1) {
      if (year === currentYear && month >= currentMonth) continue;
      const total = totalByMonth[`${year}-${month}`];
      if (!Number.isFinite(total)) continue;
      valuesByYear[year][month - 1] = roundReportNumber(total);
    }
  });

  const headerRow = worksheet.getRow(4);
  headerRow.values = ["Tháng", ...years];
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
    setCellBorder(cell);
  });

  for (let month = 1; month <= 12; month += 1) {
    const row = worksheet.getRow(4 + month);
    row.getCell(1).value = month;
    years.forEach((year, yearIndex) => {
      row.getCell(yearIndex + 2).value = formatDnpSheetNumber(valuesByYear[year][month - 1]);
    });
  }

  const totalRow = worksheet.getRow(17);
  totalRow.getCell(1).value = "TổngBQ";
  const averageRow = worksheet.getRow(18);
  averageRow.getCell(1).value = "BQ/năm";

  years.forEach((year, yearIndex) => {
    const values = valuesByYear[year].filter((value) => value !== null);
    const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
    totalRow.getCell(yearIndex + 2).value = values.length ? formatDnpSheetNumber(total) : "";
    averageRow.getCell(yearIndex + 2).value = year < currentYear && values.length
      ? formatDnpSheetNumber(total / values.length)
      : "";
  });

  for (let rowNumber = 5; rowNumber <= 18; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { horizontal: "center", vertical: "middle" };
      setCellBorder(cell);
    });
  }
  [17, 18].forEach((rowNumber) => {
    worksheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
    });
  });

  worksheet.columns = [{ width: 16 }, ...years.map(() => ({ width: 16 }))];
  worksheet.views = [{ state: "frozen", ySplit: 4 }];
};

export const exportDailyReport = async (req, res) => {
  try {
    const {
      loggerIds = [],
      fromDate,
      toDate,
      startHour = "00:00",
      endHour = "00:00",
      includeDnpReport = false,
      user,
    } = req.body;
    const ids = normalizeReportIds(loggerIds).slice(0, 80);
    const requestUser = Number(user);
    const numericUser = Number.isFinite(requestUser) ? requestUser : Number(req.user?.user ?? 0);
    const fromDay = toLocalDateOnly(fromDate);
    const toDay = toLocalDateOnly(toDate);

    if (!ids.length) {
      return res.status(400).json({ success: false, error: "Chưa chọn logger" });
    }
    if (!Number.isFinite(numericUser)) {
      return res.status(400).json({ success: false, error: "User không hợp lệ" });
    }
    if (Number.isNaN(fromDay.getTime()) || Number.isNaN(toDay.getTime()) || fromDay > toDay) {
      return res.status(400).json({ success: false, error: "Khoảng ngày không hợp lệ" });
    }
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const yesterday = addLocalDays(today, -1);
    const lastRequestedWindow = makeDailyWindow({ reportDay: toDay, startHour, endHour });
    if (toDay > yesterday || lastRequestedWindow.end > now) {
      return res.status(400).json({
        success: false,
        error: "Chỉ xuất báo cáo đến ngày hôm qua trở về vì hôm nay chưa đủ dữ liệu",
      });
    }

    const displayDays = [];
    for (let day = new Date(fromDay); day <= toDay; day = addLocalDays(day, 1)) {
      displayDays.push(new Date(day));
    }
    if (displayDays.length > 62) {
      return res.status(400).json({ success: false, error: "Chỉ xuất tối đa 62 ngày mỗi lần" });
    }

    const calculationDays = [addLocalDays(fromDay, -1), ...displayDays];
    const firstWindow = makeDailyWindow({ reportDay: calculationDays[0], startHour, endHour });
    const lastWindow = makeDailyWindow({ reportDay: displayDays[displayDays.length - 1], startHour, endHour });
    const [infos, rows, dnpConfig] = await Promise.all([
      InfoSen.find({ user: numericUser, id: { $in: ids } }).select("id name group").lean(),
      Sensor.find({
        user: numericUser,
        index: { $in: ids },
        createAt: { $gte: firstWindow.start, $lte: lastWindow.end },
      })
        .select("index flow sum createAt -_id")
        .sort({ index: 1, createAt: 1 })
        .lean(),
      DnpConfig.findOne({ user: numericUser }).lean(),
    ]);
    const dnpLoggerIds = [...new Set((dnpConfig?.loggerIds || []).map(Number).filter(Number.isFinite))];
    const dnpRows = dnpLoggerIds.length
      ? await Sensor.find({
        user: numericUser,
        index: { $in: dnpLoggerIds },
        createAt: { $gte: firstWindow.start, $lte: lastWindow.end },
      })
        .select("index flow sum createAt -_id")
        .sort({ index: 1, createAt: 1 })
        .lean()
      : [];

    const infoById = Object.fromEntries(infos.map((info) => [info.id, info]));
    const rowsById = rows.reduce((map, row) => {
      if (!map[row.index]) map[row.index] = [];
      map[row.index].push(row);
      return map;
    }, {});
    const dnpRowsById = dnpRows.reduce((map, row) => {
      if (!map[row.index]) map[row.index] = [];
      map[row.index].push(row);
      return map;
    }, {});

    const metricsByDayKey = {};
    const dnpTotalsByDayKey = {};
    calculationDays.forEach((day) => {
      const key = day.toLocaleDateString("sv-SE");
      const { start, end } = makeDailyWindow({ reportDay: day, startHour, endHour });
      metricsByDayKey[key] = Object.fromEntries(ids.map((id) => [
        id,
        getDailyLoggerMetric(rowsById[id] || [], start, end),
      ]));
      dnpTotalsByDayKey[key] = dnpLoggerIds.reduce((sum, id) => (
        sum + Number(getDailyLoggerMetric(dnpRowsById[id] || [], start, end).volume || 0)
      ), 0);
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Bao cao ngay");
    const dayStartCol = 4;
    const totalCols = dayStartCol + displayDays.length * 2 - 1;

    worksheet.mergeCells(1, 1, 1, totalCols);
    worksheet.getCell(1, 1).value = "BẢNG TỔNG HỢP THEO DÕI CÁC ĐỒNG HỒ LOGGER VÀ NƯỚC DNP";
    worksheet.getCell(1, 1).font = { bold: true, size: 14 };
    worksheet.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(2, 1, 3, 1);
    worksheet.mergeCells(2, 2, 3, 2);
    worksheet.mergeCells(2, 3, 3, 3);
    worksheet.getCell(2, 1).value = "STT";
    worksheet.getCell(2, 2).value = "TÊN ĐH";
    worksheet.getCell(2, 3).value = `m3/ngày/tháng ${formatReportMonth(fromDay)}`;

    displayDays.forEach((day, index) => {
      const col = dayStartCol + index * 2;
      worksheet.mergeCells(2, col, 2, col + 1);
      worksheet.getCell(2, col).value = formatReportDay(day);
      worksheet.getCell(3, col).value = "m3";
      worksheet.getCell(3, col + 1).value = "Min(m3/h)";
    });

    [1, 2, 3].forEach((rowIndex) => {
      worksheet.getRow(rowIndex).eachCell((cell) => {
        cell.font = { ...(cell.font || {}), bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowIndex === 1 ? "FFE2F0D9" : "FFD9EAF7" } };
        setCellBorder(cell);
      });
    });

    const writeDayPair = ({ row, startCol, value, minFlow }) => {
      row.getCell(startCol).value = roundReportNumber(value);
      row.getCell(startCol + 1).value = minFlow === null || minFlow === undefined ? "" : roundReportNumber(minFlow);
    };

    const writeDeltaPair = ({ row, startCol, current, previous, includeMin = true }) => {
      const volumeDelta = roundReportNumber(Number(current.volume || 0) - Number(previous?.volume || 0));
      row.getCell(startCol).value = volumeDelta;
      applyDeltaCellStyle(row.getCell(startCol));
      row.getCell(startCol + 1).value = includeMin && current.minFlow !== null && previous?.minFlow !== null
        ? roundReportNumber(Number(current.minFlow) - Number(previous.minFlow))
        : "";
      applyDeltaCellStyle(row.getCell(startCol + 1));
    };

    let rowIndex = 4;
    const totalRow = worksheet.getRow(rowIndex++);
    totalRow.getCell(2).value = "Tổng nước DNP";
    totalRow.getCell(3).value = "Tổng M3";
    const totalDeltaRow = worksheet.getRow(rowIndex++);
    totalDeltaRow.getCell(3).value = "Tăng, giảm";

    displayDays.forEach((day, index) => {
      const key = day.toLocaleDateString("sv-SE");
      const previousKey = addLocalDays(day, -1).toLocaleDateString("sv-SE");
      const total = roundReportNumber(dnpTotalsByDayKey[key] || 0);
      const previousTotal = roundReportNumber(dnpTotalsByDayKey[previousKey] || 0);
      const col = dayStartCol + index * 2;
      writeDayPair({ row: totalRow, startCol: col, value: total, minFlow: null });
      const deltaCell = totalDeltaRow.getCell(col);
      deltaCell.value = roundReportNumber(total - previousTotal);
      applyDeltaCellStyle(deltaCell);
      totalDeltaRow.getCell(col + 1).value = "";
    });

    ids.forEach((id, index) => {
      const info = infoById[id] || {};
      const valueRow = worksheet.getRow(rowIndex++);
      const deltaRow = worksheet.getRow(rowIndex++);
      valueRow.getCell(1).value = index + 1;
      valueRow.getCell(2).value = info.name || `Logger ${id}`;
      valueRow.getCell(3).value = "Tổng M3";
      deltaRow.getCell(3).value = "Tăng, giảm";

      displayDays.forEach((day, dayIndex) => {
        const key = day.toLocaleDateString("sv-SE");
        const previousKey = addLocalDays(day, -1).toLocaleDateString("sv-SE");
        const current = metricsByDayKey[key]?.[id] || { volume: 0, minFlow: null };
        const previous = metricsByDayKey[previousKey]?.[id] || { volume: 0, minFlow: null };
        const col = dayStartCol + dayIndex * 2;
        writeDayPair({ row: valueRow, startCol: col, value: current.volume, minFlow: current.minFlow });
        writeDeltaPair({ row: deltaRow, startCol: col, current, previous });
      });
    });

    worksheet.columns = [
      { width: 8 },
      { width: 34 },
      { width: 14 },
      ...displayDays.flatMap(() => [{ width: 11 }, { width: 11 }]),
    ];
    for (let row = 4; row < rowIndex; row++) {
      worksheet.getRow(row).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        if (colNumber >= dayStartCol && typeof cell.value === "number") {
          cell.numFmt = "0.00";
        }
        setCellBorder(cell);
      });
      worksheet.getRow(row).getCell(2).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    }
    worksheet.views = [{ state: "frozen", xSplit: 3, ySplit: 3 }];

    if (includeDnpReport) {
      await appendDnpMonthlyAverageSheet(workbook, { user: numericUser });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`bao-cao-ngay-${fromDay.toLocaleDateString("sv-SE")}.xlsx`)}`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Không xuất được báo cáo ngày:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: "Không xuất được báo cáo ngày" });
    }
  }
};

export const getSensorProduction = async (req, res) => {
  try {
    const { id, user, startHour = "00:00", endHour = "23:59" } = req.body;
    const days = Math.min(Math.max(Number(req.body.days) || 7, 1), 90);
    const sensorId = Number(id);
    const numericUser = Number(user);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const past24Start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const past48Start = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const previousMonthEnd = todayStart > monthStart ? todayStart : monthStart;
    const previousYearEnd = todayStart > yearStart ? todayStart : yearStart;
    const rangeEnd = new Date(now);
    rangeEnd.setHours(23, 59, 59, 999);

    const [
      dayTotal,
      previousDayTotal,
      total24,
      previous24Total,
      monthTotal,
      previousMonthTotal,
      yearTotal,
      previousYearTotal,
    ] = await Promise.all([
      getProductionVolume({ user: numericUser, id: sensorId, start: todayStart, end: now }),
      getProductionVolume({ user: numericUser, id: sensorId, start: yesterdayStart, end: todayStart }),
      getProductionVolume({ user: numericUser, id: sensorId, start: past24Start, end: now }),
      getProductionVolume({ user: numericUser, id: sensorId, start: past48Start, end: past24Start }),
      getProductionVolume({ user: numericUser, id: sensorId, start: monthStart, end: now }),
      getProductionVolume({ user: numericUser, id: sensorId, start: monthStart, end: previousMonthEnd }),
      getProductionVolume({ user: numericUser, id: sensorId, start: yearStart, end: now }),
      getProductionVolume({ user: numericUser, id: sensorId, start: yearStart, end: previousYearEnd }),
    ]);

    const startTime = parseHourMinute(startHour, "00:00");
    const endTime = parseHourMinute(endHour, "23:59");
    const startMinute = startTime.hour * 60 + startTime.minute;
    const endMinute = endTime.hour * 60 + endTime.minute;
    const chartStart = new Date(now);
    chartStart.setDate(chartStart.getDate() - days + 1);
    chartStart.setHours(0, 0, 0, 0);

    const rows = await Sensor.find({
      user: numericUser,
      index: sensorId,
      createAt: { $gte: chartStart, $lte: rangeEnd },
      sum: { $ne: null },
    })
      .select("sum createAt -_id")
      .sort({ createAt: 1 })
      .lean();

    const grouped = {};
    rows.forEach((row) => {
      const date = new Date(row.createAt);
      const minuteOfDay = toMinutesOfDay(date);
      const inWindow = startMinute <= endMinute
        ? minuteOfDay >= startMinute && minuteOfDay <= endMinute
        : minuteOfDay >= startMinute || minuteOfDay <= endMinute;
      if (!inWindow) return;

      const key = date.toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    });

    const chartData = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
      const dayRows = grouped[key] || [];
      const volume = dayRows.length >= 2
        ? Math.max(Number(dayRows[dayRows.length - 1].sum) - Number(dayRows[0].sum), 0)
        : 0;
      chartData.push({ date: key, volume });
    }

    return res.status(200).json({
      success: true,
      dayTotal,
      previousDayTotal,
      total24,
      previous24Total,
      monthTotal,
      previousMonthTotal,
      yearTotal,
      previousYearTotal,
      chartData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không lấy được sản lượng sensor" });
  }
};

// const formatDate = (dateString) => {
//   const date = new Date(dateString);
//   const datePart = date.toLocaleDateString("vi-VN"); // Định dạng dd/mm/yyyy
//   const timePart = date.toLocaleTimeString("vi-VN", { hour12: false, hour: "2-digit", minute: "2-digit" }); // HH:MM

//   return `${datePart} ${timePart}`; // Kết quả dạng "dd/mm/yyyy HH:MM"
// };
function getRowIndexFromTime(timeStr) {
  const [hourStr, minStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const slot = hour * 4 + Math.floor(minute / 15);
  return 3 + slot; // bắt đầu từ dòng 3
}

const exportFakeDataToExcel = async (sensorData, res, adj) => {
  try {
    const workbook = new ExcelJS.Workbook();

    // === 1. Viết phần Tổng Hợp (All Stats) ===
    const summarySheet = workbook.addWorksheet("Summary");
    const worksheet = workbook.addWorksheet("Sensors");
    const stats = sensorData[0].stats

    // === 2. Viết phần Từng Ngày (EndOfDay Summary) ===
    worksheet.getRow(1).getCell(1).value = 'Thời gian';
    worksheet.getRow(1).getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(1, 1, 2, 1); // merge ô thời gian (A1:A2)
    const endOfDaySum = sensorData[0].endOfDaySum
    summarySheet.columns = [
      { header: "Ngày", key: "day", width: 12 },
      { header: "Sản lượng", key: "production", width: 12 },
      { header: "Áp suất avg", key: "avgPressure", width: 12 },
      { header: "Áp suất min", key: "minPressure", width: 12 },
      { header: "Thời gian min", key: "minPressureTime", width: 15 },
      { header: "Áp suất max", key: "maxPressure", width: 12 },
      { header: "Thời gian max", key: "maxPressureTime", width: 15 },
      { header: "Lưu lượng avg", key: "avgFlow", width: 12 },
      { header: "Lưu lượng min", key: "minFlow", width: 12 },
      { header: "Thời gian min", key: "minFlowTime", width: 15 },
      { header: "Lưu lượng max", key: "maxFlow", width: 12 },
      { header: "Thời gian max", key: "maxFlowTime", width: 15 },
      { header: "Tổng cuối ngày", key: "totalSum", width: 12 },
    ];
    for (let i = 0; i < 96; i++) {
      const hour = Math.floor(i / 4);
      const minute = (i % 4) * 15;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      worksheet.getRow(3 + i).getCell(1).value = timeStr;
    }
    endOfDaySum.forEach((daySum, idx) => {
      summarySheet.addRow({
        day: daySum._id?.day ?? "",
        production: daySum.lastSum && daySum.firstSum ? (daySum.lastSum - daySum.firstSum).toFixed(1) : "",
        avgPressure: daySum.avgPressure?.toFixed(1) ?? "",
        minPressure: daySum.minPressure?.pressure?.toFixed(1) ?? "",
        minPressureTime: daySum.minPressure?.createAt ?? "",
        maxPressure: daySum.maxPressure?.pressure?.toFixed(1) ?? "",
        maxPressureTime: daySum.maxPressure?.createAt ?? "",
        avgFlow: daySum.avgFlow?.toFixed(2) ?? "",
        minFlow: daySum.minFlow?.flow?.toFixed(2) ?? "",
        minFlowTime: daySum.minFlow?.createAt ?? "",
        maxFlow: daySum.maxFlow?.flow?.toFixed(2) ?? "",
        maxFlowTime: daySum.maxFlow?.createAt ?? "",
        totalSum: daySum.lastSum?.toFixed(1) ?? "",
      });
      const startCol = 2 + idx * 4; // mỗi ngày chiếm 4 cột
      const endCol = startCol + 3;

      // Merge các cột con thành 1 ô ngày
      worksheet.mergeCells(1, startCol, 1, endCol);
      worksheet.getRow(1).getCell(startCol).value = daySum._id?.day ?? "";
      worksheet.getRow(1).getCell(startCol).alignment = { horizontal: 'center' };

      // Ghi tên cột con
      worksheet.getRow(2).getCell(startCol).value = 'Áp suất';
      worksheet.getRow(2).getCell(startCol + 1).value = 'Lưu lượng';
      worksheet.getRow(2).getCell(startCol + 2).value = 'Sản lượng';
      worksheet.getRow(2).getCell(startCol + 3).value = 'Sum';
      daySum.data?.forEach(entry => {
        if (Math.floor(entry.createAt / 60000) % 15) {
          return; // chỉ lấy mỗi 15 phút 1 lần
        }
        const date = new Date(entry.createAt);
        const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); // HH:mm
        const rowIndex = getRowIndexFromTime(timeStr);
        const row = worksheet.getRow(rowIndex);

        row.getCell(startCol).value = entry.Pressure;
        row.getCell(startCol + 1).value = entry.flow;
        row.getCell(startCol + 2).value = (entry.sum - daySum.firstSum).toFixed(1);
        row.getCell(startCol + 3).value = Number.isFinite(Number(entry.sum)) ? Number(entry.sum).toFixed(1) : "";
      });
    });
    summarySheet.addRow([]);
    summarySheet.addRow(["TỔNG HỢP TOÀN BỘ"]);
    summarySheet.addRow(["Áp suất avg", stats.avgPressure?.toFixed(1) ?? ""]);
    summarySheet.addRow(["Áp suất min", stats.minPressure?.pressure?.toFixed(1) ?? "", "Lúc", stats.minPressure?.createAt ?? ""]);
    summarySheet.addRow(["Áp suất max", stats.maxPressure?.pressure?.toFixed(1) ?? "", "Lúc", stats.maxPressure?.createAt ?? ""]);
    summarySheet.addRow(["Lưu lượng avg", stats.avgFlow?.toFixed(2) ?? ""]);
    summarySheet.addRow(["Lưu lượng min", stats.minFlow?.flow?.toFixed(2) ?? "", "Lúc", stats.minFlow?.createAt ?? ""]);
    summarySheet.addRow(["Lưu lượng max", stats.maxFlow?.flow?.toFixed(2) ?? "", "Lúc", stats.maxFlow?.createAt ?? ""]);

    // === 3. Viết phần Data Chi Tiết ===
    // worksheet.addRow(["DỮ LIỆU CHI TIẾT"]);
    // worksheet.columns = [
    //   { header: "Thời gian", key: "createAt", width: 30 },
    //   { header: "Áp suất", key: "Pressure", width: 15 },
    //   { header: "Lưu lượng", key: "flow", width: 15 },
    //   { header: "Số tổng", key: "sum", width: 15 },
    // ];
    // sensorData[0]?.data?.forEach(sensor => {
    //   if (Math.floor(sensor.createAt / 60000) % 15) {
    //     return; // chỉ lấy mỗi 15 phút 1 lần
    //   }
    //   worksheet.addRow({
    //     createAt: formatDate(sensor.createAt),
    //     Pressure: (sensor.Pressure + adj)?.toFixed(1),
    //     flow: sensor.flow?.toFixed(2),
    //     sum: sensor.sum?.toFixed(1)
    //   });
    // });

    // ✅ Ghi ra buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(excelBuffer);

    // ✅ Đặt header chính xác
    res.setHeader("Content-Disposition", 'attachment; filename="export.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(buffer); // ⚡ Đúng cách truyền file binary
  } catch (error) {
    console.error("❌ Lỗi server khi xuất Excel:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};


export const exportSensors = async (req, res) => {
  try {
    const { sen_name, adj, date, user } = req.body;
    const startOfToday = new Date(date[0]);
    const endOfToday = new Date(date[1]);
    startOfToday.setUTCSeconds(0, 0);
    endOfToday.setUTCSeconds(0, 999);
    const sensorData = await Sensor.aggregate([
      {
        $match: {
          index: sen_name,
          user: user,
          createAt: { $gte: startOfToday, $lte: endOfToday },
        }
      },
      { $sort: { createAt: 1 } },
      {
        $facet: {
          data: [
            { $project: { _id: 0, Pressure: 1, flow: 1, createAt: 1, sum: 1 } }
          ],
          stats: [
            {
              $group: {
                _id: null,
                firstSum: { $first: "$sum" },
                lastSum: { $last: "$sum" },
                avgPressure: { $avg: "$Pressure" },
                minPressure: {
                  $min: {
                    pressure: "$Pressure",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                maxPressure: {
                  $max: {
                    pressure: "$Pressure",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                avgFlow: { $avg: "$flow" },
                minFlow: {
                  $min: {
                    flow: "$flow",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                maxFlow: {
                  $max: {
                    flow: "$flow",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
              }
            }
          ],
          endOfDaySum: [
            {
              $group: {
                _id: {
                  day: { $dateToString: { format: "%Y-%m-%d", date: "$createAt", timezone: "+07:00" } }
                },
                data: {
                  $push: {
                    createAt: "$createAt",
                    Pressure: "$Pressure",
                    flow: "$flow",
                    sum: "$sum"
                  }
                },
                firstSum: { $first: "$sum" }, // sum đầu tiên trong ngày
                lastSum: { $last: "$sum" },    // sum cuối cùng trong ngày
                avgPressure: { $avg: "$Pressure" },
                minPressure: {
                  $min: {
                    pressure: "$Pressure",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                maxPressure: {
                  $max: {
                    pressure: "$Pressure",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                avgFlow: { $avg: "$flow" },
                minFlow: {
                  $min: {
                    flow: "$flow",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                maxFlow: {
                  $max: {
                    flow: "$flow",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
              }
            },
            { $sort: { "_id.day": 1 } }
          ]
        }
      },
      {
        $project: {
          data: 1,
          stats: { $arrayElemAt: ["$stats", 0] },
          endOfDaySum: 1
        }
      }
    ]);
    return exportFakeDataToExcel(sensorData, res, adj);
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: "Add Sensor server error." });
    }
  }
};

export const upInterval = async (req, res) => {
  const profs = req.body;
  const configAction = typeof profs.configAction === "string" ? profs.configAction : null;
  try {
    if (profs.Coor != null) {
      const updateCoor = await InfoSen.findOneAndUpdate({ id: profs.Coor, user: profs.user },
        {
          $set: {
            lat: parseFloat(profs.lat),
            lng: parseFloat(profs.lng)
          }
        },
        { new: true }
      )
      return res.status(200).json({ success: true })
    }
    if(profs.upTime != null) {
      const timeNow = Math.floor(Date.now() / 1000);
      const result = await publishMessage(
        5,
        timeNow,
        profs.sen_id,
        profs.user,
        null,
        configAction || "upTime"
      )
      return sendConfigPendingResponse(res, result)
    }
    if (profs.sum != null) {
      // if (publishMessage(14, Number(profs.sum).toFixed(1) * 10, profs.sen_id)) {
      //   return res.status(500).json({ success: false, error: "Not publish" })
      // }
      const result = await publishMessage(
        14,
        Number(profs.sum).toFixed(1) * 10,
        profs.sen_id,
        profs.user,
        null,
        configAction || "sum"
      )
      return sendConfigPendingResponse(res, result)
    }
    if (profs.unit != null) {
      // if (publishMessage(4, Number(profs.unit), profs.sen_id)) {
      //   return res.status(500).json({ success: false, error: "Not publish" })
      // }
      const result = await publishMessage(
        4,
        Number(profs.unit),
        profs.sen_id,
        profs.user,
        null,
        configAction || "unit"
      )
      return sendConfigPendingResponse(res, result)
    }
    if (profs.adj != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { adj: profs.adj } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.watch != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { watch: profs.watch } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.displaySettings != null) {
      const info = await InfoSen.findOneAndUpdate(
        { id: profs.sen_id, user: profs.user },
        { $set: { displaySettings: profs.displaySettings } },
        { new: true }
      )
      return res.status(200).json({ success: true, displaySettings: info.displaySettings })
    }
    if (profs.notificationChannels != null) {
      const channels = {
        telegram: profs.notificationChannels.telegram !== false,
        fcm: profs.notificationChannels.fcm === true,
      }
      const info = await InfoSen.findOneAndUpdate(
        { id: profs.sen_id, user: profs.user },
        { $set: { notificationChannels: channels } },
        { new: true }
      )
      return res.status(200).json({ success: true, notificationChannels: info.notificationChannels })
    }
    if (profs.alertTimes != null) {
      const result = profs.alertTimes
        .reduce((arr, v, i) => {
          if (v === "" && i > 0) {
            arr.push(arr[i - 1])
          } else {
            arr.push(v)
          }
          return arr
        }, [])
        .map(v => String(Number(v)))
        .join(" ")
      // if (publishMessage(6, result, profs.sen_id)) {
      //   return res.status(500).json({ success: false, error: "Not publish" })
      // }
      const result1 = await publishMessage(
        6,
        result,
        profs.sen_id,
        profs.user,
        { alertTimes: profs.alertTimes },
        configAction || "alertTimes"
      )
      return sendConfigPendingResponse(res, result1, { alertTimes: profs.alertTimes })
    }
    if (profs.highAlerts != null) {
      // const inputPress = profs.wPress < 0 ? 0 : Number(profs.wPress).toFixed(2) * 100;
      // if (publishMessage(7, profs.highAlerts.map((v) => `${Number(v) * 10}`).join(" "), profs.sen_id)) {
      //   return res.status(500).json({ success: false, error: "Not publish" })
      // }
      const result1 = await publishMessage(
        7,
        profs.highAlerts.map((v) => `${Number(v) * 10}`).join(" "),
        profs.sen_id,
        profs.user,
        { highAlerts: profs.highAlerts },
        configAction || "highAlerts"
      )
      return sendConfigPendingResponse(res, result1)
    }
    if (profs.lowAlerts != null) {
      // const inputPress = profs.wPress < 0 ? 0 : Number(profs.wPress).toFixed(2) * 100;
      // if (publishMessage('wPress', inputPress, profs.sen_id)) {
      //   return res.status(500).json({ success: false, error: "Not publish" })
      // }
      // if (publishMessage(8, profs.lowAlerts.map((v) => `${Number(v) * 10}`).join(" "), profs.sen_id)) {
      //   return res.status(500).json({ success: false, error: "Not publish" })
      // }
      const result1 = await publishMessage(
        8,
        profs.lowAlerts.map((v) => `${Number(v) * 10}`).join(" "),
        profs.sen_id,
        profs.user,
        { lowAlerts: profs.lowAlerts },
        configAction || "lowAlerts"
      )
      return sendConfigPendingResponse(res, result1)
    }
    if (profs.flowHighs != null) {
      // if (publishMessage(9, profs.flowHighs.map((v) => `${Number(v) * 10}`).join(" "), profs.sen_id)) {
      //   return res.status(500).json({ success: false, error: "Not publish" })
      // }
      const result1 = await publishMessage(
        9,
        profs.flowHighs.map((v) => `${Number(v) * 10}`).join(" "),
        profs.sen_id,
        profs.user,
        { flowHighs: profs.flowHighs },
        configAction || "flowHighs"
      )
      return sendConfigPendingResponse(res, result1)
    }
    if (profs.flowLows != null) {
      // if (publishMessage(10, profs.flowLows.map((v) => `${Number(v) * 10}`).join(" "), profs.sen_id)) {
      //   return res.status(500).json({ success: false, error: "Not publish" })
      // }
      const result1 = await publishMessage(
        10,
        profs.flowLows.map((v) => `${Number(v) * 10}`).join(" "),
        profs.sen_id,
        profs.user,
        { flowLows: profs.flowLows },
        configAction || "flowLows"
      )
      return sendConfigPendingResponse(res, result1)
    }
    if (profs.tracking != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { tracking: profs.tracking } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.isWarning != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { isWarning: profs.isWarning } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.onP != null) {
      const result = await publishMessage(
        11,
        Number(profs.onP),
        profs.sen_id,
        profs.user,
        { onP: profs.onP },
        configAction || "onP"
      )
      return sendConfigPendingResponse(res, result)
    }
    
    if (profs.onF != null) {
      const result = await publishMessage(
        12,
        Number(profs.onF),
        profs.sen_id,
        profs.user,
        { onF: profs.onF },
        configAction || "onF"
      )
      return sendConfigPendingResponse(res, result)
    }
    if (profs.temp != null) {
      const inputTemp = profs.temp < 0 ? 100 : Math.floor(Number(profs.temp));
      const result = await publishMessage(
        3,
        inputTemp,
        profs.sen_id,
        profs.user,
        { temperature: profs.temp },
        configAction || "temp"
      )
      return sendConfigPendingResponse(res, result)
    }
    if (profs.sample != null) {
      // if (publishMessage(2, profs.sample, profs.sen_id)) {
      //   return res.status(500).json({ success: false, error: "Not publish" })
      // }
      const result = await publishMessage(
        2,
        Number(profs.sample),
        profs.sen_id,
        profs.user,
        { sample: profs.sample },
        configAction || "sample"
      )
      return sendConfigPendingResponse(res, result)
    }
    // if (publishMessage(1, profs.interval, profs.sen_id)) {
    //   return res.status(500).json({ success: false, error: "Not publish" })
    // }
    const result = await publishMessage(
      1,
      Number(profs.interval),
      profs.sen_id,
      profs.user,
      { interval: profs.interval },
      configAction || "interval"
    )
    return sendConfigPendingResponse(res, result)
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}

function compare(profs, i, start) {
  if (profs.date[1]) {
    const startOfToday = new Date(profs.date[i]);
    const nowDay = new Date(profs.date[i]);
    startOfToday.setHours(0, 0, 0, 0);
    nowDay.setHours(23, 59, 59, 59);
    return { $gte: startOfToday, $lte: nowDay };
  }
  const viewMode = profs.viewModes && profs.viewModes[profs.info[i].id] ? profs.viewModes[profs.info[i].id] : 'today';
  if (viewMode === 'past24h') {
    const now = new Date(profs.date[0]);
    const past24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { $gte: past24, $lte: now };
  }
  return { $gte: start };
}

function secondsUntilEndOfDay() {
  const now = new Date();
  const end = new Date();

  end.setHours(23, 59, 59, 999); // cuối ngày

  return Math.floor((end - now) / 1000); // đổi ms → s
}


export const getSensors = async (req, res) => {
  try {
    const profs = req.body;
    const sensors = []
    const timeTrackingRet = []
    const temperature = []
    const battery = []
    const pram = []
    const pramFlow = []
    if (profs.totalMap) {
      const senMap = {};
      for (let i = 0; i < Number(profs.totalMap.length); i++) {
        const sensor = await Sensor.findOne({ index: profs.totalMap[i].id, user: profs.totalMap[0].user }).sort({ $natural: -1 });
        senMap[profs.totalMap[i].id] = sensor
      }
      return res.status(200).json({ success: true, sensors: senMap })
    }
    if (profs.timeGet) {
      const lengModal = 288
      const startOfToday = new Date(profs.timeGet[0]);
      const endOfToday = new Date(profs.timeGet[1]);
      startOfToday.setUTCSeconds(0, 0);
      endOfToday.setUTCSeconds(0, 999);
      const result = await Sensor.aggregate([
        {
          $match: {
            index: profs.sen_name,
            user: profs.user,
            createAt: { $gte: startOfToday, $lte: endOfToday }
          }
        },
        { $sort: { createAt: 1 } },
        {
          $facet: {
            data: [
              { $project: { _id: 0, Pressure: 1, flow: 1, createAt: 1 } }
            ],
            stats: [
              {
                $group: {
                  _id: null,
                  firstSum: { $first: "$sum" },
                  lastSum: { $last: "$sum" },
                  avgPressure: { $avg: "$Pressure" },
                  minPressure: {
                    $min: {
                      pressure: "$Pressure",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  maxPressure: {
                    $max: {
                      pressure: "$Pressure",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  avgFlow: { $avg: "$flow" },
                  minFlow: {
                    $min: {
                      flow: "$flow",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  maxFlow: {
                    $max: {
                      flow: "$flow",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                }
              }
            ],
            endOfDaySum: [
              {
                $group: {
                  _id: {
                    day: { $dateToString: { format: "%Y-%m-%d", date: "$createAt", timezone: "+07:00" } }
                  },
                  firstSum: { $first: "$sum" }, // sum đầu tiên trong ngày
                  lastSum: { $last: "$sum" },    // sum cuối cùng trong ngày
                  avgPressure: { $avg: "$Pressure" },
                  minPressure: {
                    $min: {
                      pressure: "$Pressure",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  maxPressure: {
                    $max: {
                      pressure: "$Pressure",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  avgFlow: { $avg: "$flow" },
                  minFlow: {
                    $min: {
                      flow: "$flow",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  maxFlow: {
                    $max: {
                      flow: "$flow",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                }
              },
              { $sort: { "_id.day": 1 } }
            ]
          }
        },
        {
          $project: {
            data: 1,
            stats: { $arrayElemAt: ["$stats", 0] },
            endOfDaySum: 1
          }
        }
      ]);
      const listDate = getDatesInRange(startOfToday, endOfToday);
      const lengArray = getLength(lengModal, listDate)
      const sensorH = []
      const flowH = []
      const sensorT = Array(lengArray).fill(null)
      const startDate = startOfToday
      const offSetHour = startOfToday.getHours() * 12
      const offSetMinute = Math.floor(startOfToday.getMinutes() / 5)
      result[0].data.forEach((sensor) => {
        const dateOfSensor = new Date(sensor.createAt)
        const currentDate = dateOfSensor
        const convert = differenceInCalendarDays(currentDate, startDate)
        const convertTimeValue = Math.floor(convertTime(sensor.createAt, 300))
        const index = convert * lengModal + convertTimeValue - offSetHour - offSetMinute;
        addDateElement(sensorH, sensor, index, "Pressure");
        addDateElement(flowH, sensor, index, "flow");
        sensorT[index] = sensor
      })
      return res.status(200).json({ success: true, sensorH, flowH, sum: result[0].endOfDaySum, param: result[0].stats, sensorT })
    }
    const startOfToday = new Date(profs.date[0]);
    const yesterday = new Date(profs.date[0]);
    let past48hStart = new Date(startOfToday.getTime() - 48 * 60 * 60 * 1000);
    let past24hStart = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    if (!profs.date[1]) {
      yesterday?.setDate(startOfToday.getDate() - 1);
      startOfToday.setHours(0, 0, 0, 0);
      yesterday?.setHours(0, 0, 0, 0);
    }
    for (let i = 0; i < Number(profs.total); i++) {
      const viewMode = profs.viewModes && profs.viewModes[profs.info[i].id] ? profs.viewModes[profs.info[i].id] : 'today';
      timeTrackingRet[i] = 0;
      const sensorY = await (async () => {
        if (!profs.date[1]) {
          if (viewMode === 'past24h') {
            const dataR = await Sensor.find({
              index: profs.info[i].id,
              user: profs.user,
              createAt: { $gte: past48hStart, $lt: past24hStart },
            })
              .select("flow Pressure createAt")
              .sort({ createAt: 1 });
            return dataR;
          }
          if (await clientRedis.exists(`sensorY:${profs.info[i].id}`)) {
            return JSON.parse(await clientRedis.get(`sensorY:${profs.info[i].id}`))
          }
          const dataR = await Sensor.find({
            index: profs.info[i].id,
            user: profs.user,
            createAt: { $gte: yesterday, $lt: startOfToday },
          })
            .select("flow Pressure createAt")
            .sort({ createAt: 1 });
          clientRedis.set(`sensorY:${profs.info[i].id}`, JSON.stringify(dataR), { EX: secondsUntilEndOfDay() });
          return dataR;
        } else {
          return [];
        }
      })();
      const result = await Sensor.aggregate([
        {
          $match: {
            index: profs.info[i].id,
            user: profs.user,
            createAt: compare(profs, i, startOfToday)
          }
        },
        { $sort: { createAt: 1 } },
        {
          $facet: {
            data: [
              { $project: { _id: 0, Pressure: 1, flow: 1, temperature: 1, battery: 1, createAt: 1 } }
            ],
            stats: [
              {
                $group: {
                  _id: null,
                  firstSum: { $first: "$sum" },
                  lastSum: { $last: "$sum" },
                  battery: { $last: "$battery" },
                  temperature: { $last: "$temperature" },
                  avgPressure: { $avg: "$Pressure" },
                  minPressure: { $min: "$Pressure" },
                  maxPressure: { $max: "$Pressure" },
                  avgFlow: { $avg: "$flow" },
                  minFlow: { $min: "$flow" },
                  maxFlow: { $max: "$flow" },
                }
              }
            ],
          }
        },
        {
          $project: {
            data: 1,
            stats: { $arrayElemAt: ["$stats", 0] },
          }
        }
      ]);
      let sensorT = Array(86400 / profs.info[i].watch).fill(null)
      let sensorYRest = []
      let flowYRest = []
      let dataPressure = []
      let dataFlow = []
      let timeTracking = 0
      let currentStart = 0;
      if (!profs.date[1] && viewMode !== 'past24h' && await clientRedis.exists(`sensorYRest:${profs.info[i].id}`)) {
        sensorYRest = JSON.parse(await clientRedis.get(`sensorYRest:${profs.info[i].id}`))
        flowYRest = JSON.parse(await clientRedis.get(`flowYRest:${profs.info[i].id}`))
      }
      else {
        sensorY.forEach((sensor) => {
          let index;
          if (viewMode === 'past24h') {
            const diffMs = new Date(sensor.createAt).getTime() - past48hStart.getTime();
            const diffMins = diffMs / 60000;
            index = Math.floor(diffMins / (profs.info[i].watch / 60));
          } else {
            index = Math.floor(convertTime(sensor.createAt, profs.info[i].watch));
          }
          if (index >= 0 && index < sensorT.length) {
            sensorYRest[index] = sensor.Pressure
            flowYRest[index] = sensor.flow
          }
        })
        if (!profs.date[1] && viewMode !== 'past24h') {
          clientRedis.set(`sensorYRest:${profs.info[i].id}`, JSON.stringify(sensorYRest), { EX: secondsUntilEndOfDay() });
          clientRedis.set(`flowYRest:${profs.info[i].id}`, JSON.stringify(flowYRest), { EX: secondsUntilEndOfDay() });
        }
      }
      if (!profs.date[1] && viewMode !== 'past24h' && await clientRedis.exists(`dataPressure:${profs.info[i].id}`)) {
        dataPressure = JSON.parse(await clientRedis.get(`dataPressure:${profs.info[i].id}`))
        dataFlow = JSON.parse(await clientRedis.get(`dataFlow:${profs.info[i].id}`))
        sensorT = JSON.parse(await clientRedis.get(`sensorT:${profs.info[i].id}`))
        timeTracking = JSON.parse(await clientRedis.get(`timeTracking:${profs.info[i].id}`))
      }
      else {
        result[0].data.forEach((sensor) => {
          let index;
          if (viewMode === 'past24h') {
            const diffMs = new Date(sensor.createAt).getTime() - past24hStart.getTime();
            const diffMins = diffMs / 60000;
            index = Math.floor(diffMins / (profs.info[i].watch / 60));
          } else {
            index = Math.floor(convertTime(sensor.createAt, profs.info[i].watch));
          }
          if (index >= 0 && index < sensorT.length) {
            addDateElement(dataPressure, sensor, index, "Pressure")
            addDateElement(dataFlow, sensor, index, "flow")
            if (profs.info[i].tracking) {
              if (sensor.Pressure >= profs.info[i].tracking) {
                const timeAdd = Math.floor((sensor.createAt - currentStart) / 1000)
                if (timeAdd < 1000) {
                  timeTracking += timeAdd
                }
              }
            }
            currentStart = sensor.createAt
            sensorT[index] = sensor
          }
        })
        if (!profs.date[1] && viewMode !== 'past24h') {
          clientRedis.set(`dataPressure:${profs.info[i].id}`, JSON.stringify(dataPressure), { EX: 60 });
          clientRedis.set(`dataFlow:${profs.info[i].id}`, JSON.stringify(dataFlow), { EX: 60 });
          clientRedis.set(`sensorT:${profs.info[i].id}`, JSON.stringify(sensorT), { EX: 60 });
          clientRedis.set(`timeTracking:${profs.info[i].id}`, JSON.stringify(timeTracking), { EX: 60 });
        }
      }
      if (result[0].data && result[0].data.length > 0) {
        const sensorY24 = await Sensor.findOne({
          index: profs.info[i].id,
          user: profs.user,
          createAt: { $gte: result[0].data[result[0].data.length - 1].createAt - 86400000 },
        }).select('sum -_id').lean();
        const stats = result[0].stats
        battery[i] = stats.battery
        temperature[i] = stats.temperature
        pram[i] = { max: stats.maxPressure, min: stats.minPressure, avg: stats.avgPressure }
        pramFlow[i] = { max: stats.maxFlow, min: stats.minFlow, total24: stats.lastSum - sensorY24.sum, total: stats.lastSum - stats.firstSum, avg: stats.avgFlow, sum: stats.lastSum };
      }
      sensors[i] = { sensorYRest, flowYRest, dataFlow, sensorT, dataPressure }
      timeTrackingRet[i] = Math.round(timeTracking / 60)
    }
    return res.status(200).json({ success: true, sensors, timeTrackingRet, battery, temperature, pram, pramFlow })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}

export const addSensor = async (req, res) => {
  try {
    const { sen_name, description, id } = req.body;

    if (!sen_name || !description) {
      return res.status(400).json({ success: false, error: "All fields are required." });
    }
    const newSen = new InfoSen({
      tracking: 1.5,
      interval: 60,
      wPress: 0.8,
      wPressTime: 1.2,
      timeAlarm: 300,
      watch: 60,
      adj: 0,
      id: id,
      name: sen_name,
      lat: 105,
      lng: 21,
      sample: 60,
      description: description,
      temperature: 30,
    })
    await newSen.save()
    return res.status(201).json({ success: true, message: "Sensor added successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Add Sensor server error." });
  }
};


export const viewSensor = async (req, res) => {
  try {
    const { id } = req.body;
    const sensor = await InfoSen.findOne({ id: id });
    return res.status(200).json({ success: true, sensor });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}


export const updateSensor = async (req, res) => {
  try {
    const { sen_name, sen_description, id } = req.body;
    const updateSensor = await InfoSen.findOneAndUpdate(
      { id: id },
      {
        $set: {
          description: sen_description,
          name: sen_name // Thêm name vào đây
        }
      },
      { new: true }
    );
    return res.status(200).json({ success: true, message: "Edit data successfully." })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor edit Failed due to some Reason " })
  }
}

export const getGroup = async (req, res) => {
  try {
    const { user } = req.query;
    const sen_group = []
    const group = []
    const Groups = await Group.find({ user: user });
    const senGroup = await InfoSen.find({ user: user });
    group.push("Không có")
    Groups.forEach((sensor) => {
      group.push(sensor.name)
    })
    senGroup.forEach((sensor) => {
      sen_group.push({ group: sensor.group, name: sensor.name })
    })
    return res.status(200).json({ success: true, group, sen_group });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const getSensorInGroup = async (req, res) => {
  try {
    const { group, user } = req.query
    const senInGroup = await InfoSen.find({ group: group, user: user }).sort({ createAt: -1 });
    return res.status(200).json({ success: true, senInGroup });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const getGroupInfo = async (req, res) => {
  try {
    const { user } = req.query
    const data = {}
    const valueSenS = []
    let dataSensorOnline = 0;
    const senGroup = await InfoSen.find({ user: user }).sort({ createAt: -1 });
    for (let i = 0; i < senGroup.length; i++) {
      const startOfToday = new Date() - senGroup[i].interval * 2000;
      const valueSen = await Sensor.findOne({ index: senGroup[i].id, user: user, createAt: { $gte: startOfToday } }).sort({ createAt: -1 });
      valueSenS[senGroup[i].id] = valueSen
      if (valueSen) {
        dataSensorOnline += 1;
      }
    }
    senGroup.forEach((sensor) => {
      // if (!sensor.group || sensor.group === "") sensor.group = "Khong co"
      if (!data[sensor.group]) data[sensor.group] = []
      data[sensor.group].push(sensor)
    })
    return res.status(200).json({ success: true, data, valueSenS, dataSensorOnline });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const changeGroup = async (req, res) => {
  try {
    const profs = req.body;
    // if (profs.newGroup === "Khong co") {
    //   const updateSensor = await InfoSen.findOneAndUpdate(
    //     { name: profs.name, user: profs.user },
    //     { $unset: { group: "" } }
    //   );
    //   return res.status(200).json({ success: true });
    // }
    const updateSensor = await InfoSen.findOneAndUpdate(
      { name: profs.name, user: profs.user },
      {
        $set: {
          group: profs.newGroup, // Thêm name vào đây
          createAt: Date.now(),
        }
      },
      { new: true }
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const deleteGroup = async (req, res) => {
  try {
    const profs = req.body;
    const delGroup = await Group.deleteOne({ name: profs.groupToRemove, user: profs.user })
    const deleteGroup = await InfoSen.updateMany({ group: profs.groupToRemove, user: profs.user }, { $set: { group: "Không có" } })
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const addGroup = async (req, res) => {
  try {
    const profs = req.body;
    const newGroup = new Group({
      name: profs.newGroup,
      user: profs.user
    })
    await newGroup.save()
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

// export const addAlarm = async (req, res) => {
//   try {
//     const profs = req.body;
//     scheduledJobs[`${profs.name}-${profs.user}-${profs.id}`] = cron.schedule(timeToCronExpr(profs.time), () => {
//       publishMessage("high_threshold", profs.flow * 1000, profs.id)
//     });
//     const newAlarm = new Alarm({
//       name: profs.name,
//       user: profs.user,
//       id: profs.id,
//       time: profs.time,
//       flow: profs.flow
//     })
//     await newAlarm.save()
//     fetchTimeAlarm(profs.user, profs.id)
//     return res.status(200).json({ success: true });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: "Alarm add failed due to some reason" });
//   }
// }

// export const getAlarm = async (req, res) => {
//   try {
//     const { user, sen_name } = req.body
//     const data = await Alarm.find({ user: user, id: sen_name });
//     data.forEach((alarm) => {
//       if (!scheduledJobs[`${alarm.name}-${user}-${sen_name}`]) {
//         scheduledJobs[`${alarm.name}-${user}-${sen_name}`] = cron.schedule(timeToCronExpr(alarm.time), () => {
//           publishMessage("high_threshold", alarm.flow * 1000, sen_name)
//         });
//       }
//     });
//     return res.status(200).json({ success: true, data });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
//   }
// }

// export const deleteAlarm = async (req, res) => {
//   try {
//     const { user, sen_name, name } = req.body
//     scheduledJobs[`${name}-${user}-${sen_name}`].stop();
//     delete scheduledJobs[`${name}-${user}-${sen_name}`];
//     await Alarm.deleteOne({ user: user, id: sen_name, name: name });
//     if (Object.keys(scheduledJobs).length === 0) {
//       publishMessage("high_threshold", 300000, sen_name)
//     }
//     else {
//       fetchTimeAlarm(user, sen_name)
//     }
//     return res.status(200).json({ success: true });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
//   }
// }
