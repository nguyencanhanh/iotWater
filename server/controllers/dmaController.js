import Dma from "../models/Dma.js";
import InfoSen from "../models/Info.js";
import Sensor from "../models/Sensor.js";
import { acquireAiUsage, releaseAiUsage, respondAiLimit } from "../utils/aiUsage.js";
import { chatComplete } from "../services/ai/index.js";
import { pipeAiStream } from "../services/ai/sse.js";
import { findIncidentsNearLoggers } from "../services/incidents.js";
import {
  buildSensorTree,
  calculateNode,
  getLeafSensorIds,
  getLoggerStats,
  normalizeIds,
  normalizeLinks,
  toDateRange,
} from "../services/dma/engine.js";

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

const buildDmaAnalysisPrompt = ({ result, context, incidents = [] }) => `Bạn là chuyên gia phân tích DMA trong hệ thống cấp nước.
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

## 4. Sự cố hiện trường đã ghi nhận
- Nếu danh sách sự cố có dữ liệu: nêu sự cố nằm gần logger nào, cách bao xa, đã xử lý chưa, và nó có giải thích được phần thất thoát đang thấy hay không.
- Nếu danh sách trống: ghi rõ "chưa có sự cố hiện trường nào được ghi nhận trong khu vực này".

## 5. Khuyến nghị xử lý
- Đưa 3-6 việc nên làm theo thứ tự ưu tiên: kiểm tra logger, đối soát đồng hồ, khảo sát rò rỉ, kiểm tra van cô lập, MNF ban đêm.
- Ưu tiên các điểm sự cố chưa xử lý xong nếu có.

## 6. Kết luận nhanh
- Viết 2-3 câu chốt lại tình hình.

QUY TẮC:
- Không bịa số liệu ngoài JSON.
- Dùng đơn vị m3 và % khi nhắc số.
- Không dùng LaTeX/MathJax. Viết số và đơn vị dưới dạng văn bản thuần, ví dụ "253.21 m3/h", không dùng $...$ hay \\text{}.
- Nếu loss âm, giải thích có thể do sai lệch đồng hồ, chênh chu kỳ ghi nhận, hoặc cấu hình nhánh chưa đúng.
- Ưu tiên phân tích để người vận hành biết cần kiểm tra điểm nào trước.
- Tuyệt đối không bịa ra sự cố hiện trường ngoài danh sách được cung cấp.

Ngữ cảnh:
${JSON.stringify(context || {}, null, 2)}

Dữ liệu DMA đã rút gọn:
${JSON.stringify(compactDmaResult(result), null, 2)}

Sự cố hiện trường do nhân viên ghi nhận quanh các logger của DMA (bán kính 500m):
${incidents.length ? JSON.stringify(incidents, null, 2) : "Không có sự cố nào được ghi nhận."}`;

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

const DMA_ANALYSIS_SYSTEM_PROMPT = "Bạn phân tích DMA cấp nước. Trả lời bằng tiếng Việt, thực tế, ưu tiên phát hiện thất thoát, nhánh bất thường và khuyến nghị vận hành.";

const buildDmaAnalysisMessages = ({ result, context, incidents }) => [
  { role: "system", content: DMA_ANALYSIS_SYSTEM_PROMPT },
  { role: "user", content: buildDmaAnalysisPrompt({ result, context, incidents }) },
];

// Gom toan bo logger cua DMA (dau vao, tieu thu va ca cay sensor nhieu tang).
const collectDmaLoggerIds = (node, acc = new Set()) => {
  if (!node) return acc;
  [...(node.inlets || []), ...(node.consumes || [])].forEach((item) => acc.add(Number(item?.id)));
  const walkTree = (nodes = []) => nodes.forEach((child) => {
    acc.add(Number(child?.id));
    walkTree(child.children || []);
  });
  walkTree(node.sensorTree || []);
  (node.children || []).forEach((child) => collectDmaLoggerIds(child, acc));
  return acc;
};

const loadDmaIncidents = async (req, { result, context }) => {
  try {
    const user = Number(context?.user ?? req.user?.user ?? 0);
    const loggerIds = [...collectDmaLoggerIds(result)].filter(Number.isFinite);
    return await findIncidentsNearLoggers({
      user: Number.isFinite(user) ? user : 0,
      loggerIds,
      fromDate: context?.fromDate,
      toDate: context?.toDate,
    });
  } catch (error) {
    console.error("Không tải được sự cố hiện trường cho DMA:", error.message);
    return [];
  }
};

const validateDmaAnalysisRequest = (req, res) => {
  const { result, context = {} } = req.body || {};
  if (!result || !result.name) {
    res.status(400).json({ success: false, error: "Chưa có kết quả DMA để phân tích" });
    return null;
  }
  return { result, context };
};

const mapDmaAiError = (res, error) => {
  const status = error?.statusCode;
  if (status === 503) {
    return res.status(503).json({
      success: false,
      error: "AI đang bận hoặc chưa sẵn sàng, vui lòng thử lại sau ít phút",
    });
  }
  if (status === 504) {
    return res.status(504).json({ success: false, error: "AI phản hồi quá lâu, vui lòng thử lại" });
  }
  console.error("Không phân tích được DMA bằng AI:", error.message);
  return res.status(502).json({
    success: false,
    error: error.message || "Không phân tích được DMA bằng AI",
  });
};

export const analyzeDma = async (req, res) => {
  let aiUsage;
  try {
    const input = validateDmaAnalysisRequest(req, res);
    if (!input) return undefined;

    aiUsage = await acquireAiUsage(req);

    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort(new Error("client disconnected"));
    });

    const incidents = await loadDmaIncidents(req, input);

    const aiResult = await chatComplete({
      messages: buildDmaAnalysisMessages({ ...input, incidents }),
      temperature: 0.2,
      longForm: true,
      signal: controller.signal,
      cacheNamespace: "dma-analysis",
    });

    const analysis = aiResult.content.trim();
    if (!analysis) {
      aiUsage = await releaseAiUsage(aiUsage).catch(() => null);
      return res.status(502).json({ success: false, error: "AI không trả về nội dung phân tích DMA" });
    }

    if (aiResult.cached) {
      aiUsage = await releaseAiUsage(aiUsage).catch(() => aiUsage);
    }

    return res.status(200).json({
      success: true,
      analysis,
      model: aiResult.model,
      provider: aiResult.provider,
      cached: aiResult.cached,
      aiUsage,
    });
  } catch (error) {
    if (error?.statusCode === 429) return respondAiLimit(res, error);
    if (aiUsage) await releaseAiUsage(aiUsage).catch(() => null);
    if (error?.statusCode === 499 || res.writableEnded) return undefined;
    return mapDmaAiError(res, error);
  }
};

export const analyzeDmaStream = async (req, res) => {
  const input = validateDmaAnalysisRequest(req, res);
  if (!input) return undefined;

  let aiUsage;
  try {
    aiUsage = await acquireAiUsage(req);
  } catch (error) {
    if (error?.statusCode === 429) return respondAiLimit(res, error);
    return res.status(500).json({ success: false, error: "Không khởi tạo được phiên phân tích AI" });
  }

  const incidents = await loadDmaIncidents(req, input);

  await pipeAiStream({
    req,
    res,
    messages: buildDmaAnalysisMessages({ ...input, incidents }),
    temperature: 0.2,
    onDone: () => ({ aiUsage }),
    onError: async () => {
      const released = await releaseAiUsage(aiUsage).catch(() => null);
      return { aiUsage: released };
    },
  });

  return undefined;
};
