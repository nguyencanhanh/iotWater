import Dma from "../models/Dma.js";
import InfoSen from "../models/Info.js";
import Sensor from "../models/Sensor.js";
import axios from "axios";
import { acquireAiUsage, releaseAiUsage, respondAiLimit } from "../utils/aiUsage.js";

const normalizeIds = (ids) => [...new Set((ids || []).map(Number).filter((id) => Number.isFinite(id)))];
const normalizeLinks = (links) => {
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
const getLeafSensorIds = (rootIds, links) => {
  const childIds = new Set((links || []).map((link) => Number(link.childId)));
  const parentIds = new Set((links || []).map((link) => Number(link.parentId)));
  const leaves = [...childIds].filter((id) => !parentIds.has(id));

  return leaves.length ? leaves : normalizeIds(rootIds);
};

const toDateRange = (fromDate, toDate) => {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getLoggerStats = async ({ user, ids, start, end }) => {
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
    ]),
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

const buildSensorTree = ({ rootIds, links, statsById }) => {
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

const toDmaPayload = (body) => ({
  user: Number(body.user),
  name: body.name,
  description: body.description || "",
  group: body.group || "",
  parentDmaId: body.parentDmaId || null,
  inletLoggerIds: normalizeIds(body.inletLoggerIds),
  consumeLoggerIds: normalizeIds(body.consumeLoggerIds),
  sensorLinks: normalizeLinks(body.sensorLinks),
});

const getAiNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
};

const compactLoggerStats = (items = []) => items.slice(0, 80).map((item) => ({
  id: item.id,
  name: item.name,
  group: item.group || "Không có",
  volume: getAiNumber(item.volume),
  minFlow: getAiNumber(item.minFlow),
  avgFlow: getAiNumber(item.avgFlow),
  maxFlow: getAiNumber(item.maxFlow),
  hasData: Boolean(item.hasData),
}));

const compactSensorTree = (nodes = [], depth = 0) => nodes.slice(0, 80).map((node) => ({
  id: node.id,
  name: node.name,
  group: node.group || "Không có",
  depth,
  volume: getAiNumber(node.volume),
  childTotal: getAiNumber(node.childTotal),
  branchLoss: getAiNumber(node.branchLoss),
  branchLossRate: getAiNumber(node.branchLossRate),
  totalBranchLoss: getAiNumber(node.totalBranchLoss),
  hasData: Boolean(node.hasData),
  children: compactSensorTree(node.children || [], depth + 1),
}));

const compactDmaResult = (node, depth = 0) => ({
  dmaId: node?.dmaId,
  name: node?.name,
  group: node?.group || "Không có",
  depth,
  fromDate: node?.fromDate,
  toDate: node?.toDate,
  inletTotal: getAiNumber(node?.inletTotal),
  consumeTotal: getAiNumber(node?.consumeTotal),
  childInletTotal: getAiNumber(node?.childInletTotal),
  accountedTotal: getAiNumber(node?.accountedTotal),
  loss: getAiNumber(node?.loss),
  lossRate: getAiNumber(node?.lossRate),
  mnf: getAiNumber(node?.mnf),
  childLossTotal: getAiNumber(node?.childLossTotal),
  inlets: compactLoggerStats(node?.inlets || []),
  consumes: compactLoggerStats(node?.consumes || []),
  sensorTree: compactSensorTree(node?.sensorTree || []),
  children: (node?.children || []).slice(0, 20).map((child) => compactDmaResult(child, depth + 1)),
});

const buildDmaAnalysisPrompt = ({ result, context }) => `Bạn là chuyên gia phân tích DMA trong hệ thống cấp nước.
Hãy phân tích dữ liệu thất thoát DMA dưới đây bằng tiếng Việt, ngắn gọn, có tính vận hành thực tế.

FORMAT BẮT BUỘC:
## 1. Tóm tắt tình hình DMA
- Nêu tổng nước cấp vào, nước đã hạch toán/tiêu thụ, thất thoát và tỷ lệ thất thoát.
- Đánh giá nhanh mức độ: ổn định / cần theo dõi / rủi ro cao.

## 2. Phân tích các nhánh chính
- Nêu nhánh/sensor/DMA con có thất thoát hoặc tỷ lệ bất thường nhất.
- Nếu có cây sensor nhiều tầng, chỉ ra điểm cha-con nào cần kiểm tra trước.

## 3. Dữ liệu thiếu hoặc chưa đủ tin cậy
- Liệt kê logger không có dữ liệu hoặc sản lượng bằng 0 nếu có.
- Nếu dữ liệu chưa đủ để kết luận, nói rõ "chưa đủ dữ liệu".

## 4. Khuyến nghị xử lý
- Đưa 3-6 việc nên làm theo thứ tự ưu tiên: kiểm tra logger, đối soát đồng hồ, khảo sát rò rỉ, kiểm tra van cô lập, MNF ban đêm.

## 5. Kết luận nhanh
- Viết 2-3 câu chốt lại tình hình.

QUY TẮC:
- Không bịa số liệu ngoài JSON.
- Dùng đơn vị m3 và % khi nhắc số.
- Nếu loss âm, giải thích có thể do sai lệch đồng hồ, chênh chu kỳ ghi nhận, hoặc cấu hình nhánh chưa đúng.
- Ưu tiên phân tích để người vận hành biết cần kiểm tra điểm nào trước.

Ngữ cảnh:
${JSON.stringify(context || {}, null, 2)}

Dữ liệu DMA đã rút gọn:
${JSON.stringify(compactDmaResult(result), null, 2)}`;

const isValidParent = async ({ user, dmaId, parentDmaId }) => {
  if (!parentDmaId) return true;
  if (dmaId && String(parentDmaId) === String(dmaId)) return false;

  let parent = await Dma.findOne({ _id: parentDmaId, user }).select("parentDmaId").lean();
  if (!parent) return false;

  while (parent?.parentDmaId) {
    if (dmaId && String(parent.parentDmaId) === String(dmaId)) return false;
    parent = await Dma.findOne({ _id: parent.parentDmaId, user }).select("parentDmaId").lean();
  }

  return true;
};

const calculateNode = async ({ dma, allDmas, user, start, end }) => {
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

export const listDma = async (req, res) => {
  try {
    const requestUser = Number(req.query.user);
    const user = Number.isFinite(requestUser) ? requestUser : Number(req.user?.user ?? 0);
    const dmas = await Dma.find({ user }).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({ success: true, dmas });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không tải được danh sách DMA" });
  }
};

export const createDma = async (req, res) => {
  try {
    const validParent = await isValidParent({
      user: Number(req.body.user),
      parentDmaId: req.body.parentDmaId,
    });
    if (!validParent) return res.status(400).json({ success: false, error: "DMA cha không hợp lệ" });

    const dma = await Dma.create(toDmaPayload(req.body));
    return res.status(201).json({ success: true, dma });
  } catch (error) {
    const message = error?.code === 11000 ? "Tên DMA đã tồn tại" : "Không tạo được DMA";
    return res.status(500).json({ success: false, error: message });
  }
};

export const updateDma = async (req, res) => {
  try {
    const body = req.body;
    const validParent = await isValidParent({
      user: Number(body.user),
      dmaId: req.params.id,
      parentDmaId: body.parentDmaId,
    });
    if (!validParent) return res.status(400).json({ success: false, error: "DMA cha không hợp lệ" });

    const dma = await Dma.findOneAndUpdate(
      { _id: req.params.id, user: Number(body.user) },
      {
        $set: {
          name: body.name,
          description: body.description || "",
          group: body.group || "",
          parentDmaId: body.parentDmaId || null,
          inletLoggerIds: normalizeIds(body.inletLoggerIds),
          consumeLoggerIds: normalizeIds(body.consumeLoggerIds),
          sensorLinks: normalizeLinks(body.sensorLinks),
          updatedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!dma) return res.status(404).json({ success: false, error: "Không tìm thấy DMA" });
    return res.status(200).json({ success: true, dma });
  } catch (error) {
    const message = error?.code === 11000 ? "Tên DMA đã tồn tại" : "Không cập nhật được DMA";
    return res.status(500).json({ success: false, error: message });
  }
};

export const deleteDma = async (req, res) => {
  try {
    const user = Number(req.query.user);
    await Dma.updateMany({ user, parentDmaId: req.params.id }, { $set: { parentDmaId: null, updatedAt: new Date() } });
    await Dma.deleteOne({ _id: req.params.id, user });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không xóa được DMA" });
  }
};

export const calculateDma = async (req, res) => {
  try {
    const { dmaId, fromDate, toDate, user } = req.body;
    const numericUser = Number(user);
    const dma = await Dma.findOne({ _id: dmaId, user: numericUser }).lean();
    if (!dma) return res.status(404).json({ success: false, error: "Không tìm thấy DMA" });

    const { start, end } = toDateRange(fromDate, toDate);
    const allDmas = await Dma.find({ user: numericUser }).lean();
    const result = await calculateNode({ dma, allDmas, user: numericUser, start, end });

    return res.status(200).json({
      success: true,
      dma,
      result: { ...result, fromDate, toDate },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Không tính được DMA" });
  }
};

export const analyzeDma = async (req, res) => {
  let aiUsage;
  try {
    const { result, context = {} } = req.body;
    if (!result || !result.name) {
      return res.status(400).json({ success: false, error: "Chưa có kết quả DMA để phân tích" });
    }

    aiUsage = await acquireAiUsage(req);
    const baseUrl = (process.env.GEMINI_WEB2API_BASE_URL || "http://127.0.0.1:8081/v1").replace(/\/+$/, "");
    const model = process.env.GEMINI_WEB2API_MODEL || "gemini-3.5-flash";
    const apiKey = process.env.GEMINI_WEB2API_API_KEY || "sk-gemini";
    const timeout = Number(process.env.GEMINI_WEB2API_TIMEOUT_MS) || 120000;
    const prompt = buildDmaAnalysisPrompt({ result, context });

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [
          {
            role: "system",
            content: "Bạn phân tích DMA cấp nước. Trả lời bằng tiếng Việt, thực tế, ưu tiên phát hiện thất thoát, nhánh bất thường và khuyến nghị vận hành.",
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
        console.error("Không hoàn lại lượt AI DMA:", releaseError.message);
      });
      aiUsage = null;
      return res.status(502).json({ success: false, error: "AI không trả về nội dung phân tích DMA" });
    }

    return res.status(200).json({ success: true, analysis, model, aiUsage });
  } catch (error) {
    if (error?.statusCode === 429) return respondAiLimit(res, error);
    if (aiUsage) await releaseAiUsage(aiUsage).catch((releaseError) => {
      console.error("Không hoàn lại lượt AI DMA:", releaseError.message);
    });
    const code = error?.code || error?.cause?.code;
    const upstreamMessage = error.response?.data?.error?.message || error.response?.data?.message;
    if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
      return res.status(503).json({
        success: false,
        error: "AI service chưa chạy hoặc backend chưa kết nối được gemini-web2api",
      });
    }
    console.error("Không phân tích được DMA bằng AI:", upstreamMessage || error.message);
    return res.status(500).json({
      success: false,
      error: upstreamMessage || "Không phân tích được DMA bằng AI",
    });
  }
};
