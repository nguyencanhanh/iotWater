import axios from "axios";
import { watersenseProvider } from "../services/externalLoggers/watersenseProvider.js";
import { datagateProvider } from "../services/externalLoggers/datagateProvider.js";

const providers = new Map([
  [watersenseProvider.id, watersenseProvider],
  [datagateProvider.id, datagateProvider],
]);

const getProvider = (providerId) => {
  const provider = providers.get(String(providerId || "").toLowerCase());
  if (!provider) {
    const error = new Error("Đơn vị cung cấp logger không tồn tại");
    error.code = "PROVIDER_NOT_FOUND";
    throw error;
  }
  return provider;
};

const sendError = (res, error, fallbackMessage) => {
  const providerMessage = error.response?.data?.message
    || error.response?.data?.messageDetail
    || error.response?.data?.error
    || (typeof error.response?.data === "string" ? error.response.data : null);
  const status = error.code === "PROVIDER_NOT_FOUND"
    ? 404
    : ["PROVIDER_NOT_CONFIGURED", "PROVIDER_TOKEN_EXPIRED", "PROVIDER_AUTH_FAILED"].includes(error.code)
      ? 503
      : axios.isAxiosError(error)
        ? (error.response?.status === 401 ? 502 : error.response?.status || 502)
        : 400;

  return res.status(status).json({
    success: false,
    error: providerMessage || error.message || fallbackMessage,
  });
};

export const listExternalLoggerProviders = (req, res) => res.json({
  success: true,
  providers: [...providers.values()].map((provider) => ({
    id: provider.id,
    name: provider.name,
    configured: provider.isConfigured(),
    paginated: provider.paginated === true,
    pageSize: provider.pageSize || null,
    manualAuthRefresh: provider.manualAuthRefresh === true,
  })),
});

export const refreshExternalLoggerToken = async (req, res) => {
  try {
    const provider = getProvider(req.params.provider);
    if (typeof provider.refreshAccessToken !== "function") {
      return res.status(400).json({ success: false, error: "Nguồn logger này không hỗ trợ đăng nhập lại" });
    }
    const result = await provider.refreshAccessToken();
    return res.json({ success: true, provider: provider.id, ...result });
  } catch (error) {
    return sendError(res, error, "Không đăng nhập lại được nguồn logger ngoài");
  }
};

export const listExternalLoggerPoints = async (req, res) => {
  try {
    const provider = getProvider(req.params.provider);
    const result = await provider.getPoints(req.query);
    const points = Array.isArray(result) ? result : result.points || [];
    return res.json({
      success: true,
      provider: provider.id,
      points,
      pagination: Array.isArray(result) ? null : result.pagination || null,
    });
  } catch (error) {
    return sendError(res, error, "Không tải được danh sách logger ngoài");
  }
};

export const getExternalLoggerData = async (req, res) => {
  try {
    const { fromDate, toDate, intervalMinutes = 1 } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, error: "Thiếu khoảng thời gian lấy dữ liệu" });
    }
    if (new Date(fromDate) >= new Date(toDate)) {
      return res.status(400).json({ success: false, error: "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc" });
    }

    const provider = getProvider(req.params.provider);
    const data = await provider.getLoggerData({
      number: req.params.number,
      fromDate,
      toDate,
      intervalMinutes,
    });
    return res.json({ success: true, provider: provider.id, ...data });
  } catch (error) {
    return sendError(res, error, "Không tải được dữ liệu logger ngoài");
  }
};
