import IncidentGroup from "../models/IncidentGroup.js";
import MapPoint from "../models/MapPoint.js";
import { estimateLeakRate, getLeakBucketLabel } from "./leakRate.js";

// Ban tin / bao cao tong hop diem su co theo khu vuc bac 1:
//   (*1) luot / tuyen da nghe: tuyen = so tuyen bac 2 khac nhau; luot = so cap (tuyen, ngay)
//        - ca diem ro ri lan luot "da nghe nhung khong tim thay diem" deu tinh.
//   (*2) so diem ro ri phat hien trong ky.
//   (*3) tong khach hang = cong theo TUNG TUYEN, moi tuyen chi tinh 1 lan trong ky du nghe
//        lai nhieu buoi (vd tuyen 120 KH nghe 3 buoi van la 120, khong phai 360). Lay so cua
//        buoi nghe gan nhat. So moi buoi = so KH da nghe nguoi tong hop nhap (0 = so KH cua tuyen).
// Nguyen nhan ro ri: so diem + % theo loai bac 1. Luu luong: tong uoc tinh tu bac muc do.

const TZ = "Asia/Ho_Chi_Minh";
const NO_AREA = "Chưa chọn khu vực";
const NO_TYPE = "Chưa phân loại";

const vnDate = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
// "01/10" (Intl vi-VN tra ve "01-10" voi chi ngay + thang).
const vnDayLabel = (value) => vnDate(value).slice(5).split("-").reverse().join("/");

const effectiveCustomers = (record) => (
  Number(record.heardCustomers) > 0 ? Number(record.heardCustomers) : Number(record.routeCustomers || 0)
);

const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

const summarizeFlow = (points) => {
  const lph = points.reduce((sum, point) => sum + estimateLeakRate(point.leakRate), 0);
  const resolvedLph = points.filter((point) => point.status === "resolved").reduce((sum, point) => sum + estimateLeakRate(point.leakRate), 0);
  return {
    points: points.length,
    lph: round(lph, 1),
    m3h: round(lph / 1000, 3),
    m3d: round((lph / 1000) * 24, 2),
    resolvedM3d: round((resolvedLph / 1000) * 24, 2),
  };
};

// Ky truoc: neu ky la tron 1 thang (ngay 1 -> cuoi thang theo gio VN) thi lay thang truoc,
// con lai lay khoang dai bang nhau ngay truoc do.
export const previousPeriod = (from, to) => {
  const shift = (date, hours) => new Date(date.getTime() + hours * 3600000);
  const fromVn = shift(from, 7);
  const toVn = shift(to, 7);
  const isFullMonth = fromVn.getUTCDate() === 1 && fromVn.getUTCHours() === 0
    && shift(toVn, 1 / 3600).getUTCDate() === 1 && toVn.getUTCMonth() === fromVn.getUTCMonth();
  if (isFullMonth) {
    const prevFrom = new Date(Date.UTC(fromVn.getUTCFullYear(), fromVn.getUTCMonth() - 1, 1) - 7 * 3600000);
    return { from: prevFrom, to: new Date(from.getTime() - 1), label: "tháng trước" };
  }
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span - 1), to: new Date(from.getTime() - 1), label: "kỳ trước" };
};

// Moi tuyen tinh 1 lan: so khach hang cua buoi nghe gan nhat trong ky (visits da sap theo ngay).
const routeCustomersTotal = (visits) => {
  const latest = new Map();
  visits.forEach((visit) => latest.set(String(visit.routeId), visit.customers));
  return [...latest.values()].reduce((sum, value) => sum + value, 0);
};

export const buildBulletin = async ({ user, filter, from, to }) => {
  const [records, areaDocs] = await Promise.all([
    MapPoint.find(filter).sort({ occurredAt: 1 }).lean(),
    IncidentGroup.find({ user, parentId: null }).sort({ sortOrder: 1, name: 1 }).lean(),
  ]);
  const points = records.filter((record) => record.kind !== "no_find");

  const areaOrder = areaDocs.map((area) => String(area._id));
  const areas = new Map();
  const getArea = (record) => {
    const key = record.areaId ? String(record.areaId) : "none";
    if (!areas.has(key)) {
      areas.set(key, { areaId: record.areaId || null, areaName: record.areaName || NO_AREA, points: 0, visits: new Map(), loosePoints: [] });
    }
    return areas.get(key);
  };

  records.forEach((record) => {
    const area = getArea(record);
    const noFind = record.kind === "no_find";
    if (!noFind) area.points += 1;
    if (!record.routeId) {
      if (!noFind) area.loosePoints.push(record);
      return;
    }
    const day = vnDate(record.occurredAt);
    const key = `${record.routeId}|${day}`;
    if (!area.visits.has(key)) {
      area.visits.set(key, {
        day,
        dayLabel: vnDayLabel(record.occurredAt),
        routeId: record.routeId,
        routeName: record.routeName,
        customers: 0,
        methods: new Set(),
        points: [],
        noFind: false,
        notes: [],
      });
    }
    const visit = area.visits.get(key);
    // Nhieu ban ghi cung tuyen cung ngay = 1 luot; lay so khach hang lon nhat da nhap.
    visit.customers = Math.max(visit.customers, effectiveCustomers(record));
    if (record.methodName) visit.methods.add(record.methodName);
    if (noFind) visit.noFind = true;
    else visit.points.push(record);
    if (record.note) visit.notes.push(record.note.trim());
  });

  const describePoints = (list) => {
    const byBucket = new Map();
    list.forEach((point) => {
      const label = getLeakBucketLabel(point.leakRate);
      byBucket.set(label, (byBucket.get(label) || 0) + 1);
    });
    return [...byBucket].map(([label, count]) => ({ label, count }));
  };

  const areaList = [...areas.values()]
    .sort((a, b) => {
      const ia = a.areaId ? areaOrder.indexOf(String(a.areaId)) : Infinity;
      const ib = b.areaId ? areaOrder.indexOf(String(b.areaId)) : Infinity;
      return ia - ib;
    })
    .map((area) => {
      const visits = [...area.visits.values()].sort((a, b) => a.day.localeCompare(b.day));
      return {
        areaId: area.areaId,
        areaName: area.areaName,
        routes: new Set(visits.map((visit) => String(visit.routeId))).size,
        visits: visits.length,
        points: area.points,
        customers: routeCustomersTotal(visits),
        lines: visits.map((visit) => ({
          day: visit.day,
          dayLabel: visit.dayLabel,
          routeName: visit.routeName,
          customers: visit.customers,
          methods: [...visit.methods],
          pointCount: visit.points.length,
          pointGroups: describePoints(visit.points),
          types: [...new Set(visit.points.map((point) => point.typeName).filter(Boolean))],
          notFound: visit.points.length === 0,
          notes: visit.notes,
        })),
        loosePoints: area.loosePoints.map((point) => ({
          title: point.title,
          dayLabel: vnDayLabel(point.occurredAt),
          leakLabel: getLeakBucketLabel(point.leakRate),
          typeName: point.typeName || "",
          note: point.note || "",
        })),
      };
    });

  // Nguyen nhan ro ri theo loai bac 1.
  const causeMap = new Map();
  points.forEach((point) => {
    const name = point.typeGroupName || NO_TYPE;
    if (!causeMap.has(name)) causeMap.set(name, { name, count: 0, types: new Map() });
    const cause = causeMap.get(name);
    cause.count += 1;
    const typeName = point.typeName || NO_TYPE;
    cause.types.set(typeName, (cause.types.get(typeName) || 0) + 1);
  });
  const causes = [...causeMap.values()]
    .sort((a, b) => b.count - a.count)
    .map((cause) => ({
      name: cause.name,
      count: cause.count,
      percent: points.length ? round((cause.count / points.length) * 100, 2) : 0,
      types: [...cause.types].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    }));

  // So sanh luu luong voi ky truoc (cung bo loc khu vuc / loai, khac thoi gian).
  const prev = previousPeriod(from, to);
  const prevFilter = { ...filter, occurredAt: { $gte: prev.from, $lte: prev.to }, kind: { $ne: "no_find" } };
  const prevPoints = await MapPoint.find(prevFilter).select("leakRate status").lean();
  const flow = summarizeFlow(points);
  const prevFlow = summarizeFlow(prevPoints);

  return {
    period: { from, to },
    totals: {
      points: points.length,
      visits: areaList.reduce((sum, area) => sum + area.visits, 0),
      routes: areaList.reduce((sum, area) => sum + area.routes, 0),
      customers: areaList.reduce((sum, area) => sum + area.customers, 0),
    },
    areas: areaList,
    causes,
    flow: {
      ...flow,
      previous: { ...prevFlow, label: prev.label, from: prev.from, to: prev.to },
      changeM3d: round(flow.m3d - prevFlow.m3d, 2),
    },
  };
};
