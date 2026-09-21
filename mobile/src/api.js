/* global URLSearchParams */

const DEFAULT_API_BASE_URL = "https://khca-s.static.good-dns.net/api/api";

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

const authHeaders = (token, extra = {}) => {
  const headers = {
    Accept: "application/json",
    ...(extra["Content-Type"] === undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
  Object.keys(headers).forEach((key) => {
    if (headers[key] === undefined) delete headers[key];
  });
  return headers;
};

const buildUrl = (path, params) => {
  const url = `${API_BASE_URL}${path}`;
  if (!params) return url;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `${url}?${query}` : url;
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { success: response.ok, raw: text };
  }
};

export const request = async (path, { method = "GET", token, body, params, headers } = {}) => {
  const response = await fetch(buildUrl(path, params), {
    method,
    headers: authHeaders(token, headers),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const data = await parseJson(response);
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
};

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  verify: (token) => request("/auth/verify", { token }),
  info: (token) => request("/auth/info", { token }),
  registerFcmToken: (token, fcmToken, platform = "expo") =>
    request("/auth/fcm-token", { method: "POST", token, body: { token: fcmToken, platform } }),
  unregisterFcmToken: (token, fcmToken) =>
    request("/auth/fcm-token", { method: "DELETE", token, body: { token: fcmToken } }),

  groups: (token, user) => request("/group", { token, params: { user } }),
  groupInfo: (token, user) => request("/group/info", { token, params: { user } }),
  sensorsInGroup: (token, user, group) => request("/group/group", { token, params: { user, group } }),
  changeGroup: (token, payload) => request("/group/change", { method: "PUT", token, body: payload }),
  addGroup: (token, payload) => request("/group/add", { method: "POST", token, body: payload }),
  deleteGroup: (token, payload) => request("/group/delete", { method: "POST", token, body: payload }),

  sensorSeries: (token, payload) => request("/sensor", { method: "POST", token, body: payload }),
  sensorAdd: (token, payload) => request("/sensor/add", { method: "POST", token, body: payload }),
  sensorView: (token, id) => request("/sensor/viewSen", { method: "POST", token, body: { id } }),
  sensorUpdate: (token, payload) => request("/sensor/updateSen", { method: "POST", token, body: payload }),
  sensorProduction: (token, payload) => request("/sensor/production", { method: "POST", token, body: payload }),
  intervalUpdate: (token, payload) => request("/sensor/data/intervalUp", { method: "POST", token, body: payload }),
  exportData: (token, payload) => request("/sensor/export", { method: "POST", token, body: payload }),

  warningHistory: (token, user, group = "", options = {}) =>
    request("/sensor/warning-history/today", {
      token,
      params: { user, group, limit: options.limit ?? 30, skip: options.skip ?? 0, date: options.date }
    }),
  homeMessages: (token, user) => request("/sensor/home-messages", { token, params: { user } }),
  createHomeMessage: (token, payload) => request("/sensor/home-messages", { method: "POST", token, body: payload }),
  deleteHomeMessage: (token, id) => request(`/sensor/home-messages/${id}`, { method: "DELETE", token }),
  report: (token, payload) => request("/sensor/report", { method: "POST", token, body: payload }),
  reportAiAnalysis: (token, payload) => request("/sensor/report/ai-analysis", { method: "POST", token, body: payload }),
  exportDailyReport: (token, payload) => request("/sensor/report/daily-export", { method: "POST", token, body: payload }),

  uploadImage: async (token, sensorId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sensorId", sensorId);
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: authHeaders(token, { "Content-Type": undefined }),
      body: formData
    });
    const data = await parseJson(response);
    if (!response.ok || data.success === false) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  },
  imageUrl: (sensorId) => `${API_BASE_URL}/upload/image/${sensorId}`,

  prvs: (token, user) => request("/prv/get", { token, params: { user } }),
  prvDetail: (token, user, prvName) =>
    request("/prv", { method: "POST", token, body: { user, prv_name: prvName } }),
  prvChange: (token, payload) => request("/prv/change", { method: "PUT", token, body: payload }),

  dmas: (token, user) => request("/dma", { token, params: { user } }),
  dmaCreate: (token, payload) => request("/dma", { method: "POST", token, body: payload }),
  dmaUpdate: (token, id, payload) => request(`/dma/${id}`, { method: "PUT", token, body: payload }),
  dmaDelete: (token, id, user) => request(`/dma/${id}`, { method: "DELETE", token, params: { user } }),
  dmaCalculate: (token, payload) => request("/dma/calculate", { method: "POST", token, body: payload }),
  dmaAnalyze: (token, payload) => request("/dma/analyze", { method: "POST", token, body: payload }),

  dnpConfig: (token, user) => request("/dnp-config", { token, params: { user } }),
  saveDnpConfig: (token, payload) => request("/dnp-config", { method: "PUT", token, body: payload }),
  generalSettings: (token, user) => request("/general-settings", { token, params: { user } }),
  saveGeneralSettings: (token, payload) => request("/general-settings", { method: "PUT", token, body: payload })
};
