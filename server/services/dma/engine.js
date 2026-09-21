import Dma from "../../models/Dma.js";
import InfoSen from "../../models/Info.js";
import Sensor from "../../models/Sensor.js";

const normalizeDmaText = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

// Tach ra khoi dmaController de trang DMA va tro ly AI dung chung mot cong thuc
// thay that thoat. Truoc day logic nay nam private trong controller nen agent
// khong goi lai duoc.

export const normalizeIds = (ids) => [...new Set((ids || []).map(Number).filter((id) => Number.isFinite(id)))];
export const normalizeLinks = (links) => {
  const seen = new Set();
  return (links || [])
    .map((link) => ({ parentId: Number(link.parentId), childId: Number(link.childId) }))
    .filter((link) => Number.isFinite(link.parentId) && Number.isFinite(link.childId) && link.parentId !== link.childId)
    .filter((link) => {
      const key = `${link.parentId}:${link.childId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
export const getLeafSensorIds = (rootIds, links) => {
  const childIds = new Set((links || []).map((link) => Number(link.childId)));
  const parentIds = new Set((links || []).map((link) => Number(link.parentId)));
  const leaves = [...childIds].filter((id) => !parentIds.has(id));

  return leaves.length ? leaves : normalizeIds(rootIds);
};

export const toDateRange = (fromDate, toDate) => {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const getLoggerStats = async ({ user, ids, start, end }) => {
  if (!ids.length) return [];

  const [stats, infos] = await Promise.all([
    Sensor.aggregate([
      {
        $match: {
          user,
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
          minFlow: { $min: "$flow" },
          avgFlow: { $avg: "$flow" },
          maxFlow: { $max: "$flow" },
          firstAt: { $first: "$createAt" },
          lastAt: { $last: "$createAt" },
        },
      },
    ]).allowDiskUse(true),
    InfoSen.find({ user, id: { $in: ids } }).select("id name group").lean(),
  ]);

  const statById = Object.fromEntries(stats.map((item) => [item._id, item]));
  const infoById = Object.fromEntries(infos.map((item) => [item.id, item]));

  return ids.map((id) => {
    const stat = statById[id];
    const info = infoById[id] || {};
    const rawVolume = Number(stat?.lastSum ?? 0) - Number(stat?.firstSum ?? 0);
    return {
      id,
      name: info.name || `Logger ${id}`,
      group: info.group || "",
      volume: Number.isFinite(rawVolume) && rawVolume > 0 ? rawVolume : 0,
      minFlow: Number(stat?.minFlow ?? 0),
      avgFlow: Number(stat?.avgFlow ?? 0),
      maxFlow: Number(stat?.maxFlow ?? 0),
      firstAt: stat?.firstAt || null,
      lastAt: stat?.lastAt || null,
      hasData: Boolean(stat),
    };
  });
};

export const buildSensorTree = ({ rootIds, links, statsById }) => {
  const linksByParent = links.reduce((map, link) => {
    if (!map[link.parentId]) map[link.parentId] = [];
    map[link.parentId].push(link.childId);
    return map;
  }, {});

  const buildNode = (id, path = []) => {
    if (path.includes(id)) return null;

    const stat = statsById[id] || {
      id,
      name: `Logger ${id}`,
      group: "",
      volume: 0,
      minFlow: 0,
      avgFlow: 0,
      maxFlow: 0,
      firstAt: null,
      lastAt: null,
      hasData: false,
    };
    const children = (linksByParent[id] || [])
      .map((childId) => buildNode(childId, [...path, id]))
      .filter(Boolean);
    const childTotal = children.reduce((sum, child) => sum + child.volume, 0);
    const branchLoss = children.length ? stat.volume - childTotal : 0;
    const branchLossRate = stat.volume > 0 ? (branchLoss / stat.volume) * 100 : 0;
    const totalBranchLoss = branchLoss + children.reduce((sum, child) => sum + child.totalBranchLoss, 0);

    return {
      ...stat,
      children,
      childTotal,
      branchLoss,
      branchLossRate,
      totalBranchLoss,
    };
  };

  return rootIds.map((id) => buildNode(id)).filter(Boolean);
};

export const calculateNode = async ({ dma, allDmas, user, start, end }) => {
  const childrenDmas = allDmas.filter((item) => String(item.parentDmaId || "") === String(dma._id));
  const sensorLinks = normalizeLinks(dma.sensorLinks);
  const linkedIds = sensorLinks.flatMap((link) => [link.parentId, link.childId]);
  const consumeIds = sensorLinks.length ? getLeafSensorIds(dma.inletLoggerIds || [], sensorLinks) : dma.consumeLoggerIds || [];
  const sensorTreeIds = normalizeIds([...(dma.inletLoggerIds || []), ...consumeIds, ...linkedIds]);
  const [inlets, consumes, children] = await Promise.all([
    getLoggerStats({ user, ids: dma.inletLoggerIds || [], start, end }),
    getLoggerStats({ user, ids: consumeIds, start, end }),
    Promise.all(childrenDmas.map((child) => calculateNode({ dma: child, allDmas, user, start, end }))),
  ]);
  const sensorTreeStats = sensorLinks.length
    ? await getLoggerStats({ user, ids: sensorTreeIds, start, end })
    : [];
  const statsById = Object.fromEntries(sensorTreeStats.map((item) => [item.id, item]));
  const sensorTree = sensorLinks.length
    ? buildSensorTree({ rootIds: dma.inletLoggerIds || [], links: sensorLinks, statsById })
    : [];

  const inletTotal = inlets.reduce((sum, item) => sum + item.volume, 0);
  const consumeTotal = consumes.reduce((sum, item) => sum + item.volume, 0);
  const childInletTotal = children.reduce((sum, item) => sum + item.inletTotal, 0);
  const childLossTotal = children.reduce((sum, item) => sum + item.loss + item.childLossTotal, 0);
  const accountedTotal = consumeTotal + childInletTotal;
  const sensorTreeLoss = sensorTree.reduce((sum, item) => sum + item.totalBranchLoss, 0);
  const loss = sensorLinks.length ? sensorTreeLoss : inletTotal - accountedTotal;
  const lossRate = inletTotal > 0 ? (loss / inletTotal) * 100 : 0;
  const mnf = inlets.reduce((sum, item) => sum + item.minFlow, 0);

  return {
    dmaId: dma._id,
    name: dma.name,
    description: dma.description || "",
    group: dma.group || "",
    parentDmaId: dma.parentDmaId || null,
    inlets,
    consumes,
    sensorLinks,
    sensorTree,
    children,
    inletTotal,
    consumeTotal,
    childInletTotal,
    childLossTotal,
    accountedTotal,
    loss,
    lossRate,
    mnf,
  };
};

export const findDmaByQuery = async ({ user, dmaQuery }) => {
  const dmas = await Dma.find({ user }).sort({ updatedAt: -1 }).lean();
  if (!dmas.length) return { dma: null, dmas: [] };

  const query = normalizeDmaText(dmaQuery);
  if (!query) return { dma: dmas.length === 1 ? dmas[0] : null, dmas };

  const scored = dmas
    .map((dma) => {
      const name = normalizeDmaText(dma.name);
      const group = normalizeDmaText(dma.group);
      let score = 0;
      if (name && name === query) score += 100;
      else if (name && query.includes(name)) score += 80;
      else if (name && name.includes(query)) score += 60;
      if (group && query.includes(group)) score += 30;
      return { dma, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return { dma: scored[0]?.dma || null, dmas };
};

export const calculateDmaResult = async ({ user, dma, fromDate, toDate }) => {
  const { start, end } = toDateRange(fromDate, toDate);
  const allDmas = await Dma.find({ user }).lean();
  return calculateNode({ dma, allDmas, user, start, end });
};
