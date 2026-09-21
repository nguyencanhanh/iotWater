import { acquireAiUsage, releaseAiUsage, respondAiLimit } from "../utils/aiUsage.js";
import {
  applySessionSlots,
  normalizeText,
  parseIntent,
} from "../services/agent/intent.js";
import {
  appendTurn,
  loadSession,
  rememberSlots,
  saveSession,
} from "../services/agent/session.js";
import {
  buildAlertPayload,
  buildComparePayload,
  buildDmaLossPayload,
  buildIncidentPayload,
  buildLoggerReport,
  buildOpenLoggerPayload,
  buildReportPayload,
  buildSystemOverviewPayload,
  findSensorCandidates,
  findSensorsByIds,
  formatLocalDateTime,
  listLoggerPayload,
  listSensors,
} from "../services/agent/tools.js";

// Cac cau hoi theo chu ky ma nguoi dung khong noi ro ngay thi lay moc mac dinh,
// thay vi hoi lai lam mat mot luot.
const defaultRange = (intent, preset) => {
  if (intent.fromDate && intent.toDate) {
    return { fromDate: intent.fromDate, toDate: intent.toDate, assumed: false };
  }

  const now = new Date();
  const start = preset === "month"
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { fromDate: start.toISOString(), toDate: end.toISOString(), assumed: true };
};

const HELP_REPLY = "Bạn có thể hỏi: “Xuất dữ liệu logger 28429 từ ngày 30/07/2026 đến 31/07/2026”, “Mở dữ liệu logger 28429”, hoặc “Liệt kê logger nhóm Bách Việt”.";

// Chỉ chặn câu mệnh lệnh ghi thật sự. Bản cũ chặn cả từ khóa lẻ như
// "cài đặt" hay "bật" nên hỏi đọc bình thường cũng bị từ chối.
const WRITE_COMMAND_PATTERN = new RegExp(
  [
    "^(hay |lam on |vui long )?(xoa|xóa|sua|sửa|cap nhat|cập nhật|doi ten|đổi tên|ghi|set|reset|khoi dong lai|khởi động lại)\\b",
    "(gui|gửi)\\s+(cai dat|cài đặt|cau hinh|cấu hình|lenh|lệnh|config)",
    "(dieu khien|điều khiển)\\s+(prv|van|logger)",
    "(bat|bật|tat|tắt)\\s+(logger|prv|van|thiet bi|thiết bị)",
  ].join("|"),
  "i"
);

const getDashboardUserNumber = (req) => {
  const bodyUser = Number(req.body?.user);
  if (Number.isFinite(bodyUser)) return bodyUser;
  return Number(req.user?.user ?? 0);
};

// Client ngắt kết nối thì hủy luôn lượt gọi AI đang chạy.
const createRequestSignal = (req, res) => {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error("client disconnected"));
  req.on("aborted", abort);
  res.on("close", () => {
    if (!res.writableEnded) abort();
  });
  return controller.signal;
};

const respond = async ({ res, session, user, sessionId, message, body }) => {
  appendTurn(session, "user", message);
  appendTurn(session, "assistant", body.reply);
  await saveSession(user, sessionId, session);
  return res.status(200).json(body);
};

export const chatWithAssistant = async (req, res) => {
  let aiUsage = null;

  try {
    const user = getDashboardUserNumber(req);
    const sessionId = String(req.body?.sessionId || "default").slice(0, 64);
    const message = String(req.body?.message || "").trim().slice(0, 1000);

    if (!message) {
      return res.status(400).json({ success: false, error: "Vui lòng nhập câu hỏi" });
    }

    const session = await loadSession(user, sessionId);

    if (WRITE_COMMAND_PATTERN.test(normalizeText(message)) || WRITE_COMMAND_PATTERN.test(message)) {
      return respond({
        res,
        session,
        user,
        sessionId,
        message,
        body: {
          success: true,
          reply: "Mình chỉ được phép đọc dữ liệu, không thực hiện lệnh sửa, xóa hay gửi cấu hình xuống thiết bị.",
          intent: { action: "refuse" },
          payload: { type: "refuse" },
          source: "rules",
        },
      });
    }

    const sensors = await listSensors(user);
    const signal = createRequestSignal(req, res);

    const parsed = await parseIntent({
      message,
      sensors,
      session,
      signal,
      beforeAiCall: () => acquireAiUsage(req),
    });

    aiUsage = parsed.aiUsage;

    // AI hỏng và phải dùng heuristic thì hoàn lại lượt cho người dùng.
    if (parsed.aiFailed && aiUsage) {
      aiUsage = await releaseAiUsage(aiUsage).catch(() => null);
    }

    const intent = applySessionSlots(parsed.intent, session);
    const meta = { source: parsed.source, provider: parsed.meta?.provider || null, cached: Boolean(parsed.meta?.cached) };

    rememberSlots(session, {
      sensorId: intent.sensorId,
      groupQuery: intent.groupQuery,
      fromDate: intent.fromDate,
      toDate: intent.toDate,
    });

    if (intent.action === "refuse") {
      return respond({
        res,
        session,
        user,
        sessionId,
        message,
        body: {
          success: true,
          reply: "Mình chỉ hỗ trợ thao tác đọc dữ liệu. Các lệnh sửa/xóa/cài đặt đã được chặn ở backend.",
          intent,
          payload: { type: "refuse" },
          aiUsage,
          ...meta,
        },
      });
    }

    if (intent.action === "help") {
      return respond({
        res,
        session,
        user,
        sessionId,
        message,
        body: {
          success: true,
          reply: intent.answer || HELP_REPLY,
          intent,
          payload: { type: "help" },
          aiUsage,
          ...meta,
        },
      });
    }

    if (intent.action === "list_loggers") {
      const payload = listLoggerPayload({ sensors, groupQuery: intent.groupQuery || intent.sensorQuery });
      return respond({
        res,
        session,
        user,
        sessionId,
        message,
        body: {
          success: true,
          reply: payload.total
            ? `Mình tìm thấy ${payload.total} logger phù hợp.`
            : "Mình chưa tìm thấy logger phù hợp với nhóm/từ khóa đó.",
          intent,
          payload,
          aiUsage,
          ...meta,
        },
      });
    }

    if (intent.action === "system_overview") {
      const payload = await buildSystemOverviewPayload({ user, sensors, groupQuery: intent.groupQuery });
      const stats = payload.stats;
      return respond({
        res,
        session,
        user,
        sessionId,
        message,
        body: {
          success: true,
          reply: stats
            ? `Hệ thống đang có ${stats.online}/${stats.total} logger online, ${stats.offline} mất tín hiệu. Sản lượng hôm nay ${stats.todayVolume ?? 0} m³, ${stats.openIncidents} sự cố chưa xử lý xong và ${stats.todayAlarms} cảnh báo trong ngày.`
            : "Mình chưa thấy logger nào trong phạm vi này.",
          intent,
          payload,
          aiUsage,
          ...meta,
        },
      });
    }

    if (intent.action === "list_alerts") {
      const payload = await buildAlertPayload({
        user,
        groupQuery: intent.groupQuery,
        fromDate: intent.fromDate,
        toDate: intent.toDate,
      });
      return respond({
        res,
        session,
        user,
        sessionId,
        message,
        body: {
          success: true,
          reply: payload.total
            ? `Có ${payload.total} cảnh báo trong khoảng ${payload.range.fromText} - ${payload.range.toText}.`
            : `Không có cảnh báo nào trong khoảng ${payload.range.fromText} - ${payload.range.toText}.`,
          intent,
          payload,
          aiUsage,
          ...meta,
        },
      });
    }

    if (intent.action === "dma_loss") {
      const range = defaultRange(intent, "month");
      rememberSlots(session, { dmaQuery: intent.dmaQuery, fromDate: range.fromDate, toDate: range.toDate });

      const payload = await buildDmaLossPayload({
        user,
        dmaQuery: intent.dmaQuery,
        fromDate: range.fromDate,
        toDate: range.toDate,
      });

      if (payload.type === "dma_candidates") {
        return respond({
          res,
          session,
          user,
          sessionId,
          message,
          body: {
            success: true,
            reply: payload.total
              ? "Bạn muốn xem thất thoát của DMA nào? Chọn giúp mình một DMA bên dưới."
              : "Hệ thống chưa khai báo DMA nào nên mình chưa tính được thất thoát.",
            intent,
            payload,
            aiUsage,
            ...meta,
          },
        });
      }

      return respond({
        res,
        session,
        user,
        sessionId,
        message,
        body: {
          success: true,
          reply: `DMA ${payload.dma.name}: đầu vào ${payload.summary.inletTotal ?? 0} m³, ghi nhận ${payload.summary.accountedTotal ?? 0} m³, thất thoát ${payload.summary.loss ?? 0} m³ (${payload.summary.lossRate ?? 0}%).${range.assumed ? " Mình lấy mặc định từ đầu tháng đến hôm nay." : ""}`,
          intent,
          payload,
          aiUsage,
          ...meta,
        },
      });
    }

    if (intent.action === "list_incidents") {
      const nearSensor = intent.sensorId
        ? sensors.find((sensor) => Number(sensor.id) === Number(intent.sensorId)) || null
        : null;

      const payload = await buildIncidentPayload({
        user,
        status: intent.incidentStatus,
        sensor: nearSensor,
        groupQuery: intent.groupQuery,
        fromDate: intent.fromDate,
        toDate: intent.toDate,
      });

      return respond({
        res,
        session,
        user,
        sessionId,
        message,
        body: {
          success: true,
          reply: payload.total
            ? `Mình tìm thấy ${payload.total} sự cố. Toàn hệ thống đang có ${payload.stats.open} điểm chưa xử lý và ${payload.stats.inProgress} điểm đang xử lý.`
            : `Không có sự cố nào khớp điều kiện. Toàn hệ thống đang có ${payload.stats.open} điểm chưa xử lý.`,
          intent,
          payload,
          aiUsage,
          ...meta,
        },
      });
    }

    if (intent.action === "compare_loggers") {
      const { found, missing } = findSensorsByIds({ sensors, sensorIds: intent.sensorIds });

      if (found.length < 2) {
        return respond({
          res,
          session,
          user,
          sessionId,
          message,
          body: {
            success: true,
            reply: "Bạn cho mình ít nhất 2 logger để so sánh nhé, ví dụ: “So sánh áp suất logger 28429 và 28430 tuần này”.",
            intent,
            payload: listLoggerPayload({ sensors, groupQuery: intent.groupQuery }),
            aiUsage,
            ...meta,
          },
        });
      }

      const range = defaultRange(intent, "day");
      rememberSlots(session, { fromDate: range.fromDate, toDate: range.toDate });

      try {
        const reportData = await buildLoggerReport({
          user,
          loggerIds: found.map((sensor) => sensor.id),
          fromDate: range.fromDate,
          toDate: range.toDate,
          intervalMinutes: intent.intervalMinutes,
        });

        const missingText = missing.length ? ` Mình không tìm thấy logger ${missing.join(", ")}.` : "";
        const assumedText = range.assumed ? " Mình lấy mặc định dữ liệu trong hôm nay." : "";

        return respond({
          res,
          session,
          user,
          sessionId,
          message,
          body: {
            success: true,
            reply: `Mình đã so sánh ${found.length} logger từ ${formatLocalDateTime(range.fromDate)} đến ${formatLocalDateTime(range.toDate)}.${missingText}${assumedText}`,
            intent,
            payload: buildComparePayload(reportData),
            aiUsage,
            ...meta,
          },
        });
      } catch (compareError) {
        return respond({
          res,
          session,
          user,
          sessionId,
          message,
          body: {
            success: true,
            reply: compareError.message || "Mình chưa so sánh được các logger này.",
            intent,
            payload: { type: "help" },
            aiUsage,
            ...meta,
          },
        });
      }
    }

    const { selected, candidates } = findSensorCandidates({
      sensors,
      sensorId: intent.sensorId,
      sensorQuery: intent.sensorQuery,
      message,
      groupQuery: intent.groupQuery,
    });

    if (!selected) {
      return respond({
        res,
        session,
        user,
        sessionId,
        message,
        body: {
          success: true,
          reply: candidates.length
            ? "Mình thấy vài logger có thể đúng, bạn chọn rõ ID giúp mình nhé."
            : "Mình chưa tìm được logger phù hợp. Bạn nhập thêm ID logger hoặc tên logger nhé.",
          intent,
          payload: {
            type: "sensor_candidates",
            candidates: candidates.map((sensor) => ({
              id: sensor.id,
              name: sensor.name || `Logger ${sensor.id}`,
              group: sensor.group || "Không có",
            })),
          },
          aiUsage,
          ...meta,
        },
      });
    }

    rememberSlots(session, { sensorId: selected.id, groupQuery: selected.group });

    if (intent.action === "open_logger") {
      const payload = await buildOpenLoggerPayload({ user, sensor: selected });
      return respond({
        res,
        session,
        user,
        sessionId,
        message,
        body: {
          success: true,
          reply: `Mình đã mở thông tin đọc được của ${payload.sensor.name} (${payload.sensor.id}).`,
          intent,
          payload,
          aiUsage,
          ...meta,
        },
      });
    }

    if (intent.action === "logger_report") {
      const fromDate = intent.fromDate ? new Date(intent.fromDate) : null;
      const toDate = intent.toDate ? new Date(intent.toDate) : null;

      if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return respond({
          res,
          session,
          user,
          sessionId,
          message,
          body: {
            success: true,
            reply: `Bạn cho mình thêm khoảng thời gian cần lấy dữ liệu cho logger ${selected.id} nhé. Ví dụ: “từ ngày 30/07/2026 đến 31/07/2026”.`,
            intent,
            payload: {
              type: "need_date_range",
              sensor: { id: selected.id, name: selected.name, group: selected.group || "Không có" },
            },
            aiUsage,
            ...meta,
          },
        });
      }

      try {
        const reportData = await buildLoggerReport({
          user,
          loggerIds: [selected.id],
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
          intervalMinutes: intent.intervalMinutes,
        });

        return respond({
          res,
          session,
          user,
          sessionId,
          message,
          body: {
            success: true,
            reply: `Mình đã lấy báo cáo đọc dữ liệu cho ${selected.name || `Logger ${selected.id}`} từ ${formatLocalDateTime(fromDate)} đến ${formatLocalDateTime(toDate)}.`,
            intent,
            payload: buildReportPayload(reportData),
            aiUsage,
            ...meta,
          },
        });
      } catch (reportError) {
        return respond({
          res,
          session,
          user,
          sessionId,
          message,
          body: {
            success: true,
            reply: reportError.message || "Mình chưa lấy được báo cáo cho khoảng thời gian này.",
            intent,
            payload: { type: "help" },
            aiUsage,
            ...meta,
          },
        });
      }
    }

    return respond({
      res,
      session,
      user,
      sessionId,
      message,
      body: {
        success: true,
        reply: HELP_REPLY,
        intent,
        payload: { type: "help" },
        aiUsage,
        ...meta,
      },
    });
  } catch (error) {
    if (error?.statusCode === 429) return respondAiLimit(res, error);
    if (aiUsage) await releaseAiUsage(aiUsage).catch(() => null);
    if (error?.statusCode === 499 || res.writableEnded) return undefined;

    console.error("Chatbot error:", error.message);
    return res.status(error?.statusCode && error.statusCode < 600 ? error.statusCode : 500).json({
      success: false,
      error: error.message || "Chatbot chưa xử lý được yêu cầu",
    });
  }
};
