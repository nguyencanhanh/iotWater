import Alarm from "../../models/AlarmFlow.js";
import Sensor from "../../models/Sensor.js";
import { chatComplete } from "../ai/index.js";
import { findIncidentsNearLoggers } from "../incidents.js";
import { normalizeText } from "./intent.js";

// Phan tich bat thuong cho mot nhom logger: server tu tinh cac chi so va phat hien
// bat thuong bang thong ke (khong phu thuoc AI), AI chi viet nhan dinh tu ket qua do.
// Nho vay AI hong thi nguoi dung van co danh sach bat thuong, va AI khong the bia so.

const TZ = "Asia/Ho_Chi_Minh";
const HOUR_MS = 3600000;
const MAX_LOGGERS = 12;
const MAX_DAYS = 92;
const MAX_CHART_POINTS = 400;
const NIGHT_HOURS = new Set([1, 2, 3, 4]);

const round = (value, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const mean = (values) => {
  const real = values.filter(Number.isFinite);
  return real.length ? real.reduce((sum, value) => sum + value, 0) / real.length : null;
};

const pearson = (xs, ys) => {
  const pairs = xs.map((x, index) => [x, ys[index]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 24) return null;
  const mx = mean(pairs.map(([x]) => x));
  const my = mean(pairs.map(([, y]) => y));
  let num = 0;
  let dx = 0;
  let dy = 0;
  pairs.forEach(([x, y]) => {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  });
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
};

const hourParts = (date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return { day: `${parts.day}/${parts.month}`, dayKey: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
};

const formatHour = (date) => {
  const { day, hour } = hourParts(date);
  return `${String(hour).padStart(2, "0")}h ${day}`;
};

const formatRange = (from, to) => (from.getTime() === to.getTime()
  ? formatHour(from)
  : `${formatHour(from)} → ${formatHour(new Date(to.getTime() + HOUR_MS))}`);

// Tach day gio lien tiep thoa dieu kien thanh cac "su kien" de bao cao gon.
const collectEvents = (hours, predicate, pick) => {
  const events = [];
  let current = null;
  hours.forEach((row) => {
    if (row && predicate(row)) {
      if (current && row.time.getTime() - current.end.getTime() <= HOUR_MS) {
        current.end = row.time;
        current.hours += 1;
        current.values.push(pick(row));
      } else {
        current = { start: row.time, end: row.time, hours: 1, values: [pick(row)] };
        events.push(current);
      }
    }
  });
  return events;
};

export const selectAnalysisSensors = ({ sensors, sensorIds = [], groupQuery = "" }) => {
  const ids = new Set(sensorIds.map(Number).filter(Number.isFinite));
  const group = normalizeText(groupQuery);
  const picked = sensors.filter((sensor) => ids.has(Number(sensor.id))
    || (group && normalizeText(sensor.group || "").includes(group)));
  return { selected: picked.slice(0, MAX_LOGGERS), total: picked.length };
};

const loadHourly = async ({ user, ids, start, end }) => Sensor.aggregate([
  { $match: { user, index: { $in: ids }, createAt: { $gte: start, $lte: end } } },
  { $sort: { createAt: 1 } },
  {
    $group: {
      _id: { index: "$index", hour: { $dateTrunc: { date: "$createAt", unit: "hour", timezone: TZ } } },
      avgP: { $avg: "$Pressure" },
      minP: { $min: "$Pressure" },
      maxP: { $max: "$Pressure" },
      avgF: { $avg: "$flow" },
      minF: { $min: "$flow" },
      maxF: { $max: "$flow" },
      firstSum: { $first: "$sum" },
      lastSum: { $last: "$sum" },
      count: { $sum: 1 },
    },
  },
]).allowDiskUse(true);

const analyzeLogger = ({ info, rows, hourSlots }) => {
  const adjust = Number(info.adj || 0);
  const byTime = new Map(rows.map((row) => [row._id.hour.getTime(), row]));
  const hours = hourSlots.map((time) => {
    const row = byTime.get(time.getTime());
    if (!row) return null;
    return {
      time,
      ...hourParts(time),
      avgP: Number(row.avgP) + adjust,
      minP: Number(row.minP) + adjust,
      maxP: Number(row.maxP) + adjust,
      avgF: Number(row.avgF),
      minF: Number(row.minF),
      maxF: Number(row.maxF),
      firstSum: Number(row.firstSum),
      lastSum: Number(row.lastSum),
      count: row.count,
    };
  });

  const present = hours.filter(Boolean);
  const findings = [];
  const add = (level, text) => findings.push({ level, text });

  const summary = {
    id: Number(info.id),
    name: info.name || `Logger ${info.id}`,
    group: info.group || "Không có",
    coverage: round((present.length / hourSlots.length) * 100, 1),
    hasFlow: present.some((row) => Number(row.maxF) > 0),
  };

  if (!present.length) {
    add("cao", "Không có bản ghi nào trong kỳ — logger mất tín hiệu hoàn toàn.");
    return { summary, findings, hours, daily: [] };
  }

  // --- Mat du lieu ---
  const gaps = collectEvents(hourSlots.map((time, index) => (hours[index] ? null : { time })), () => true, () => 0)
    .filter((gap) => gap.hours >= 3)
    .sort((a, b) => b.hours - a.hours);
  const missingHours = hourSlots.length - present.length;
  if (gaps.length) {
    add(
      gaps[0].hours >= 24 ? "cao" : "trung bình",
      `Mất dữ liệu ${missingHours} giờ (${summary.coverage}% số giờ có dữ liệu). Khoảng dài nhất: ${formatRange(gaps[0].start, gaps[0].end)} (${gaps[0].hours} giờ)${gaps.length > 1 ? `, tổng ${gaps.length} khoảng ≥ 3 giờ` : ""}.`
    );
  }

  // --- Ap luc ---
  const pMedian = median(present.map((row) => row.avgP));
  summary.pressure = {
    median: round(pMedian),
    avg: round(mean(present.map((row) => row.avgP))),
    min: round(Math.min(...present.map((row) => row.minP))),
    max: round(Math.max(...present.map((row) => row.maxP))),
  };

  // So voi muc BINH THUONG CUA TUNG KHUNG GIO (trung vi 30 ngay), khong so voi mot
  // nguong chung: van dieu ap ha ap ban dem theo lich se khong bi tinh la tut ap.
  const profile = Array.from({ length: 24 }, (unused, hour) => {
    const same = present.filter((row) => row.hour === hour);
    return {
      avgP: median(same.map((row) => row.avgP)),
      minP: median(same.map((row) => row.minP)),
      maxP: median(same.map((row) => row.maxP)),
      swing: median(same.map((row) => row.maxP - row.minP)),
      days: same.length,
    };
  });
  const enoughHistory = profile.every((item) => item.days >= 5);

  if (Number.isFinite(pMedian) && pMedian > 0) {
    // Lich ap theo gio (vi du ha ap dem) - la thong tin van hanh, khong phai bat thuong.
    const hourly = profile.map((item) => item.avgP).filter(Number.isFinite);
    const lowHour = profile.reduce((best, item, hour) => (item.avgP < profile[best].avgP ? hour : best), 0);
    const highHour = profile.reduce((best, item, hour) => (item.avgP > profile[best].avgP ? hour : best), 0);
    if (enoughHistory && Math.max(...hourly) - Math.min(...hourly) >= Math.max(pMedian * 0.25, 3)) {
      summary.pressure.dailyPattern = `thấp nhất ~${round(profile[lowHour].avgP, 1)} m lúc ${lowHour}h, cao nhất ~${round(profile[highHour].avgP, 1)} m lúc ${highHour}h`;
      add(
        "thông tin",
        `Áp thay đổi theo giờ lặp lại hằng ngày: ${summary.pressure.dailyPattern}. Đây là quy luật vận hành (điều áp theo giờ/nhu cầu), các bất thường bên dưới đã được so với đúng khung giờ này.`
      );
    }

    const expectedMin = (row) => (enoughHistory ? profile[row.hour].minP : pMedian);
    const expectedMax = (row) => (enoughHistory ? profile[row.hour].maxP : pMedian);
    const band = (row) => Math.max((enoughHistory ? profile[row.hour].avgP : pMedian) * 0.3, 3);

    const drops = collectEvents(hours, (row) => row.minP < expectedMin(row) - band(row), (row) => ({
      value: row.minP,
      expected: expectedMin(row),
    }));
    if (drops.length) {
      const lowest = (event) => Math.min(...event.values.map((item) => item.value));
      const worst = [...drops].sort((a, b) => lowest(a) - lowest(b)).slice(0, 4);
      add(
        drops.length >= 5 || lowest(worst[0]) < 2 ? "cao" : "trung bình",
        `Tụt áp bất thường ${drops.length} lần (thấp hơn hẳn mức thường có cùng khung giờ). Nặng nhất: ${worst.map((event) => {
          const low = event.values.reduce((min, item) => (item.value < min.value ? item : min));
          return `${formatRange(event.start, event.end)} còn ${round(low.value, 1)} m (thường ~${round(low.expected, 1)} m)`;
        }).join("; ")}.`
      );
    }

    const surges = collectEvents(hours, (row) => row.maxP > expectedMax(row) + band(row), (row) => ({
      value: row.maxP,
      expected: expectedMax(row),
    }));
    if (surges.length) {
      const highest = (event) => Math.max(...event.values.map((item) => item.value));
      const worst = [...surges].sort((a, b) => highest(b) - highest(a)).slice(0, 3);
      add(
        "trung bình",
        `Áp tăng vọt bất thường ${surges.length} lần so với cùng khung giờ (có thể do va đập thủy lực, đóng van nhanh, van điều áp dao động). Cao nhất: ${worst.map((event) => {
          const top = event.values.reduce((max, item) => (item.value > max.value ? item : max));
          return `${formatRange(event.start, event.end)} lên ${round(top.value, 1)} m (thường ~${round(top.expected, 1)} m)`;
        }).join("; ")}.`
      );
    }

    // Dao dong trong gio lon bat thuong so voi chinh khung gio do cac ngay khac.
    const swingMedian = median(present.map((row) => row.maxP - row.minP));
    const swingHours = present.filter((row) => {
      const normal = enoughHistory ? profile[row.hour].swing : swingMedian;
      return row.maxP - row.minP > Math.max((normal || 0) * 3, pMedian * 0.3, 5);
    });
    if (swingHours.length >= 3) {
      add(
        "thấp",
        `${swingHours.length} giờ có áp dao động mạnh bất thường trong giờ (bình thường ~${round(swingMedian, 1)} m), ví dụ ${swingHours.slice(0, 3).map((row) => `${formatHour(row.time)} (${round(row.minP, 1)}–${round(row.maxP, 1)} m)`).join(", ")}.`
      );
    }
  }

  const stuck = collectEvents(hours, (row) => row.count >= 3 && row.maxP === row.minP && (!summary.hasFlow || row.maxF === row.minF), () => 0)
    .filter((event) => event.hours >= 6);
  if (stuck.length) {
    add(
      "trung bình",
      `Giá trị đứng yên không đổi ${stuck.map((event) => `${formatRange(event.start, event.end)} (${event.hours} giờ)`).slice(0, 3).join("; ")} — nghi cảm biến treo hoặc đường ống bị cô lập.`
    );
  }

  // --- Theo ngay ---
  const dayMap = new Map();
  present.forEach((row) => {
    if (!dayMap.has(row.dayKey)) dayMap.set(row.dayKey, { day: row.day, dayKey: row.dayKey, rows: [] });
    dayMap.get(row.dayKey).rows.push(row);
  });
  const daily = [...dayMap.values()].map(({ day, dayKey, rows: dayRows }) => {
    const night = dayRows.filter((row) => NIGHT_HOURS.has(row.hour));
    return {
      day,
      dayKey,
      hours: dayRows.length,
      avgP: round(mean(dayRows.map((row) => row.avgP))),
      minP: round(Math.min(...dayRows.map((row) => row.minP))),
      maxP: round(Math.max(...dayRows.map((row) => row.maxP))),
      avgF: summary.hasFlow ? round(mean(dayRows.map((row) => row.avgF))) : null,
      maxF: summary.hasFlow ? round(Math.max(...dayRows.map((row) => row.maxF))) : null,
      // Luu luong dem toi thieu (1h-5h): chi so kinh dien de phat hien ro ri nen.
      mnf: summary.hasFlow && night.length ? round(Math.min(...night.map((row) => row.avgF))) : null,
      // Tong cac gio co du lieu; ngay thieu gio se thap hon thuc te.
      volume: summary.hasFlow ? round(dayRows.reduce((sum, row) => sum + (Number.isFinite(row.avgF) ? row.avgF : 0), 0), 1) : null,
    };
  });

  // --- Luu luong ---
  if (!summary.hasFlow) {
    add("thông tin", "Logger không ghi nhận lưu lượng (luôn = 0) — chỉ đo áp, nên chỉ phân tích được áp lực.");
  } else {
    const fullDays = daily.filter((day) => day.hours >= 20);
    const flowMedian = median(present.map((row) => row.avgF));
    summary.flow = {
      median: round(flowMedian),
      avg: round(mean(present.map((row) => row.avgF))),
      max: round(Math.max(...present.map((row) => row.maxF))),
      totalVolume: round(daily.reduce((sum, day) => sum + (day.volume || 0), 0), 0),
      mnfMedian: round(median(daily.map((day) => day.mnf))),
    };

    const mnfDays = daily.filter((day) => Number.isFinite(day.mnf));
    if (mnfDays.length >= 10) {
      const head = mean(mnfDays.slice(0, 7).map((day) => day.mnf));
      const tail = mean(mnfDays.slice(-7).map((day) => day.mnf));
      if (head > 0 && (tail - head) / head >= 0.2 && tail - head >= 0.5) {
        add(
          "cao",
          `Lưu lượng đêm tối thiểu (1h–5h) tăng dần: 7 ngày đầu TB ${round(head, 1)} m³/h → 7 ngày cuối ${round(tail, 1)} m³/h (+${round(((tail - head) / head) * 100, 0)}%). Dấu hiệu rò rỉ mới phát sinh.`
        );
      } else if (head > 0 && (head - tail) / head >= 0.2 && head - tail >= 0.5) {
        add(
          "thấp",
          `Lưu lượng đêm tối thiểu giảm: ${round(head, 1)} → ${round(tail, 1)} m³/h (có thể đã xử lý được điểm rò hoặc giảm áp).`
        );
      }
    }

    const dayAvgMedian = median(fullDays.map((day) => day.avgF));
    if (Number.isFinite(summary.flow.mnfMedian) && dayAvgMedian > 0) {
      const ratio = summary.flow.mnfMedian / dayAvgMedian;
      summary.flow.mnfRatio = round(ratio * 100, 0);
      if (ratio >= 0.5) {
        add(
          "cao",
          `Lưu lượng đêm tối thiểu cao: ${round(summary.flow.mnfMedian, 1)} m³/h, bằng ${round(ratio * 100, 0)}% lưu lượng TB ngày (thường < 30–40%). Nghi rò rỉ nền hoặc có hộ dùng nước ban đêm lớn.`
        );
      } else if (ratio >= 0.4) {
        add("trung bình", `Lưu lượng đêm tối thiểu bằng ${round(ratio * 100, 0)}% lưu lượng TB ngày — ở ngưỡng cần theo dõi.`);
      }
    }

    // Ngay co san luong lech xa so voi cac ngay khac (chi xet ngay du du lieu).
    const volumes = fullDays.map((day) => day.volume);
    const volumeMedian = median(volumes);
    if (volumeMedian > 0 && fullDays.length >= 7) {
      const high = fullDays.filter((day) => day.volume > volumeMedian * 1.4);
      const low = fullDays.filter((day) => day.volume < volumeMedian * 0.6);
      if (high.length) {
        add("trung bình", `Sản lượng tăng bất thường ngày ${high.slice(0, 5).map((day) => `${day.day} (${day.volume} m³)`).join(", ")} so với mức thường ~${round(volumeMedian, 0)} m³/ngày.`);
      }
      if (low.length) {
        add("trung bình", `Sản lượng giảm bất thường ngày ${low.slice(0, 5).map((day) => `${day.day} (${day.volume} m³)`).join(", ")} so với mức thường ~${round(volumeMedian, 0)} m³/ngày.`);
      }
    }

    // Luu luong ve 0 trong gio cao diem trong khi binh thuong van chay.
    if (flowMedian > 1) {
      const zeroDaytime = collectEvents(hours, (row) => row.hour >= 6 && row.hour <= 21 && row.maxF <= 0, () => 0)
        .filter((event) => event.hours >= 2);
      if (zeroDaytime.length) {
        add(
          "cao",
          `Lưu lượng bằng 0 vào ban ngày ${zeroDaytime.slice(0, 4).map((event) => `${formatRange(event.start, event.end)}`).join("; ")} — nghi cắt nước, đóng van hoặc lỗi đồng hồ.`
        );
      }
    }

    const sumDrops = present.filter((row, index) => index > 0 && row.firstSum < present[index - 1].lastSum - 1);
    if (sumDrops.length) {
      add("trung bình", `Chỉ số đồng hồ tích lũy bị giảm ${sumDrops.length} lần (ví dụ ${formatHour(sumDrops[0].time)}) — nghi reset hoặc thay đồng hồ.`);
    }

    const corr = pearson(present.map((row) => row.avgP), present.map((row) => row.avgF));
    summary.pressureFlowCorrelation = round(corr);
    if (Number.isFinite(corr) && corr > 0.3) {
      add(
        "thấp",
        `Áp và lưu lượng biến thiên CÙNG chiều (hệ số tương quan ${round(corr)}), ngược với quy luật thường gặp (dùng nhiều → áp giảm). Có thể logger đặt ngay sau van/bơm điều tiết.`
      );
    }
  }

  return { summary, findings, hours, daily };
};

const buildChartData = ({ results, hourSlots }) => {
  const step = Math.max(1, Math.ceil(hourSlots.length / MAX_CHART_POINTS));
  const labels = [];
  for (let index = 0; index < hourSlots.length; index += step) labels.push(hourSlots[index].toISOString());

  const bucket = (hours, key) => labels.map((_, bucketIndex) => {
    const slice = hours.slice(bucketIndex * step, bucketIndex * step + step).filter(Boolean);
    // Ap lay gia tri thap nhat de tut ap khong bi trung binh hoa mat tren bieu do.
    if (!slice.length) return null;
    return key === "minP" ? round(Math.min(...slice.map((row) => row.minP))) : round(mean(slice.map((row) => row[key])));
  });

  return {
    labels,
    intervalMinutes: step * 60,
    series: results.map(({ summary, hours }) => ({
      id: summary.id,
      name: summary.name,
      group: summary.group,
      pressureValues: bucket(hours, "minP"),
      flowValues: summary.hasFlow ? bucket(hours, "avgF") : labels.map(() => null),
      meterValues: [],
    })),
  };
};

export const buildAnomalyData = async ({ user, sensors, fromDate, toDate, groupLabel }) => {
  let end = new Date(toDate);
  let start = new Date(fromDate);
  const now = new Date();
  if (end > now) end = now;
  if (end.getTime() - start.getTime() > MAX_DAYS * 86400000) start = new Date(end.getTime() - MAX_DAYS * 86400000);

  const firstHour = new Date(Math.ceil(start.getTime() / HOUR_MS) * HOUR_MS);
  const hourSlots = [];
  for (let time = firstHour.getTime(); time + HOUR_MS <= end.getTime() + 1; time += HOUR_MS) hourSlots.push(new Date(time));
  if (hourSlots.length < 6) throw new Error("Khoảng thời gian quá ngắn để phân tích bất thường (cần ít nhất vài giờ).");

  const ids = sensors.map((sensor) => Number(sensor.id));
  const [rows, alarms, incidents] = await Promise.all([
    loadHourly({ user, ids, start, end }),
    Alarm.aggregate([
      { $match: { user, createAt: { $gte: start, $lte: end }, sensorId: { $in: ids } } },
      {
        $group: {
          _id: { sensorId: "$sensorId", type: "$type" },
          count: { $sum: 1 },
          minValue: { $min: "$value" },
          maxValue: { $max: "$value" },
          firstAt: { $min: "$createAt" },
          lastAt: { $max: "$createAt" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]).catch(() => []),
    findIncidentsNearLoggers({ user, loggerIds: ids, fromDate: start, toDate: end }).catch(() => []),
  ]);

  const rowsById = rows.reduce((result, row) => {
    const id = Number(row._id.index);
    (result[id] ||= []).push(row);
    return result;
  }, {});

  const results = sensors.map((info) => analyzeLogger({ info, rows: rowsById[Number(info.id)] || [], hourSlots }));
  const levelRank = { cao: 0, "trung bình": 1, "thấp": 2, "thông tin": 3 };
  results.forEach((result) => result.findings.sort((a, b) => levelRank[a.level] - levelRank[b.level]));

  return {
    group: groupLabel,
    fromDate: start.toISOString(),
    toDate: end.toISOString(),
    rangeText: `${hourParts(start).day}/${start.getFullYear()} → ${hourParts(end).day}/${end.getFullYear()}`,
    days: round(hourSlots.length / 24, 1),
    results,
    alarms: alarms.map((item) => ({
      logger: item._id.sensorId,
      loai: item._id.type,
      soLan: item.count,
      giaTriMin: round(item.minValue),
      giaTriMax: round(item.maxValue),
      dauTien: formatHour(item.firstAt),
      cuoiCung: formatHour(item.lastAt),
    })),
    incidents,
    chart: buildChartData({ results, hourSlots }),
  };
};

/* ------------------------------ Prompt cho AI ------------------------------ */

const SYSTEM_PROMPT = "Bạn là kỹ sư vận hành mạng cấp nước, chuyên phát hiện rò rỉ và bất thường áp lực. Viết nhận định bằng tiếng Việt từ số liệu được cung cấp. Chỉ trả về Markdown thuần, không code fence, không công thức LaTeX, không lời dẫn. Tuyệt đối không bịa số liệu, thời điểm hay sự kiện không có trong dữ liệu.";

const buildPrompt = (data) => {
  const loggers = data.results.map(({ summary, findings, daily }) => ({
    logger: `${summary.name} (${summary.id})`,
    tyLeGioCoDuLieu: `${summary.coverage}%`,
    coDoLuuLuong: summary.hasFlow,
    apLuc_m: summary.pressure,
    luuLuong: summary.flow || null,
    tuongQuanApLuuLuong: summary.pressureFlowCorrelation ?? null,
    batThuongDaPhatHien: findings.map((item) => `[${item.level}] ${item.text}`),
    // Bang theo ngay: ngay | so gio co du lieu | ap TB/min/max (m) | luu luong TB/max (m3/h) | luu luong dem toi thieu | san luong (m3)
    theoNgay: daily.map((day) => [day.day, day.hours, day.avgP, day.minP, day.maxP, day.avgF, day.maxF, day.mnf, day.volume].join(" | ")),
  }));

  return `Phân tích bất thường nhóm logger "${data.group}" trong ${data.days} ngày (${data.rangeText}).

Hệ thống ĐÃ tự phát hiện bất thường bằng thống kê (mục batThuongDaPhatHien). Nhiệm vụ của bạn:
1. Xác nhận/diễn giải các bất thường đó, xếp theo mức độ nghiêm trọng.
2. Đối chiếu chéo giữa các logger trong nhóm (cùng thời điểm tụt áp? lưu lượng tăng ở một điểm kéo áp điểm khác giảm?), và với cảnh báo, sự cố hiện trường.
3. Đọc bảng theo ngày để tìm thêm xu hướng mà bộ lọc thống kê bỏ sót.
4. Nêu nguyên nhân khả dĩ và việc cần làm cụ thể cho đội hiện trường.
Nếu không có gì bất thường đáng kể thì nói rõ là vận hành ổn định.

Đơn vị: áp lực m (mét cột nước), lưu lượng m³/h, sản lượng m³. Ngày viết dạng dd/mm.
Ngày cuối cùng trong bảng có thể là hôm nay (chưa hết ngày) nên ít giờ và sản lượng thấp hơn là bình thường, KHÔNG coi là mất dữ liệu hay bất thường.
Cột theoNgay: ngày | số giờ có dữ liệu | áp TB | áp min | áp max | lưu lượng TB | lưu lượng max | lưu lượng đêm tối thiểu (1h–5h) | sản lượng. Ô trống = không đo.

TRẢ VỀ ĐÚNG KHUNG:
# PHÂN TÍCH BẤT THƯỜNG NHÓM ${String(data.group).toUpperCase()}
## Kết luận nhanh
(2–4 gạch đầu dòng: có bất thường không, nghiêm trọng nhất là gì)
## Chi tiết theo logger
(mỗi logger một mục ###, liệt kê bất thường kèm thời điểm và con số)
## Liên hệ áp lực – lưu lượng và giữa các logger
## Nguyên nhân khả dĩ và đề xuất xử lý
(danh sách đánh số, việc ưu tiên cao lên đầu)
## Hạn chế dữ liệu
(chỉ khi có mất dữ liệu hoặc logger không đo lưu lượng)

DỮ LIỆU LOGGER:
${JSON.stringify(loggers, null, 1)}

CẢNH BÁO TRONG KỲ (gom theo logger + loại, giá trị là ngưỡng vượt):
${data.alarms.length ? JSON.stringify(data.alarms) : "Không có cảnh báo."}

SỰ CỐ HIỆN TRƯỜNG GẦN CÁC LOGGER (bán kính 500 m):
${data.incidents.length ? JSON.stringify(data.incidents) : "Không có sự cố nào được ghi nhận."}`;
};

export const writeAnomalyAnalysis = async ({ data, signal }) => {
  const result = await chatComplete({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(data) },
    ],
    temperature: 0.2,
    longForm: true,
    signal,
    cacheNamespace: "group-anomaly",
  });

  let text = String(result.content || "").trim()
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const headingIndex = text.search(/#\s*PHÂN TÍCH BẤT THƯỜNG/i);
  if (headingIndex > 0) text = text.slice(headingIndex).trim();

  return { analysis: text, provider: result.provider, model: result.model, cached: Boolean(result.cached) };
};

export const buildAnomalyPayload = ({ data, analysis, aiError, truncatedFrom }) => ({
  type: "anomaly_analysis",
  group: data.group,
  fromDate: data.fromDate,
  toDate: data.toDate,
  rangeText: data.rangeText,
  days: data.days,
  analysis: analysis?.analysis || "",
  provider: analysis?.provider || null,
  aiError: aiError || "",
  truncatedFrom: truncatedFrom || 0,
  loggers: data.results.map(({ summary, findings }) => ({ ...summary, findings })),
  alarmCount: data.alarms.reduce((sum, item) => sum + item.soLan, 0),
  incidentCount: data.incidents.length,
  reportData: {
    ...data.chart,
    fromDate: data.fromDate,
    toDate: data.toDate,
  },
});
