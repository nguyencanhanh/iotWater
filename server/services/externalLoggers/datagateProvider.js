import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import { load } from "cheerio";
import { fileURLToPath } from "url";

dotenv.config({
  path: fileURLToPath(new URL("../../.env.external-loggers", import.meta.url)),
  override: false,
});

const providerId = "datagate";
const providerName = "Datagate / DataView";
const defaultBaseUrl = "https://dataviewapi.datagate.vn/api";
const defaultIdentityUrl = "https://identity.datagate.vn";
const defaultClientId = "HWM.DataView";
const defaultRedirectUri = "https://dataview.datagate.vn/authentication/login-callback/";
const defaultScope = "openid profile dataview-api datagate-api users-api";
const requestTimeoutMs = 30000;
const connectionTimeoutMs = 24 * 60 * 60 * 1000;
const vietnamOffsetMs = 7 * 60 * 60 * 1000;
const tokenRenewBeforeMs = 60 * 1000;

let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;
let loginPromise = null;
const identityCookies = new Map();

const getConfig = () => ({
  baseUrl: process.env.EXTERNAL_LOGGER_DATAGATE_BASE_URL || defaultBaseUrl,
  identityUrl: process.env.EXTERNAL_LOGGER_DATAGATE_IDENTITY_URL || defaultIdentityUrl,
  clientId: process.env.EXTERNAL_LOGGER_DATAGATE_CLIENT_ID || defaultClientId,
  redirectUri: process.env.EXTERNAL_LOGGER_DATAGATE_REDIRECT_URI || defaultRedirectUri,
  scope: process.env.EXTERNAL_LOGGER_DATAGATE_SCOPE || defaultScope,
  token: process.env.EXTERNAL_LOGGER_DATAGATE_TOKEN || "",
  username: process.env.EXTERNAL_LOGGER_DATAGATE_USERNAME || "",
  password: process.env.EXTERNAL_LOGGER_DATAGATE_PASSWORD || "",
  accountId: Number(process.env.EXTERNAL_LOGGER_DATAGATE_ACCOUNT_ID || 76),
});

const getTokenExpiration = (token) => {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return Number(payload.exp) * 1000;
  } catch {
    return 0;
  }
};

const requestConfig = (config, accessToken) => ({
  timeout: requestTimeoutMs,
  headers: {
    accept: "text/plain",
    authorization: `Bearer ${accessToken}`,
  },
});

const updateIdentityCookies = (headers) => {
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie") || ""];
  values.forEach((value) => {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) identityCookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  });
};

const identityRequest = async (url, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (identityCookies.size) {
    headers.set("cookie", [...identityCookies].map(([key, value]) => `${key}=${value}`).join("; "));
  }
  const response = await fetch(url, {
    ...options,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  updateIdentityCookies(response.headers);
  return response;
};

const responseLocation = async (response, baseUrl) => {
  const headerLocation = response.headers.get("location");
  if (headerLocation) return new URL(headerLocation, baseUrl);
  if (!response.ok) return null;
  const html = await response.text();
  const $ = load(html);
  const dataUrl = $("meta[http-equiv='refresh']").attr("data-url");
  return dataUrl ? new URL(dataUrl, baseUrl) : null;
};

const loginFormRequest = async (loginUrl, config) => {
  const formResponse = await identityRequest(loginUrl);
  if (!formResponse.ok) throw new Error(`Không mở được trang đăng nhập Datagate (${formResponse.status})`);
  const $ = load(await formResponse.text());
  const returnUrl = $("input[name='ReturnUrl']").attr("value");
  const antiForgeryToken = $("input[name='__RequestVerificationToken']").attr("value");
  if (!returnUrl || !antiForgeryToken) throw new Error("Không đọc được biểu mẫu đăng nhập Datagate");

  const response = await identityRequest(loginUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: new URL(config.identityUrl).origin,
      referer: loginUrl.href,
    },
    body: new URLSearchParams({
      ReturnUrl: returnUrl,
      Username: config.username,
      Password: config.password,
      button: "login",
      __RequestVerificationToken: antiForgeryToken,
    }),
  });
  const nextUrl = await responseLocation(response, loginUrl);
  if (!nextUrl) {
    const error = new Error("Không đăng nhập được Datagate, hãy kiểm tra tài khoản hoặc mật khẩu");
    error.code = "PROVIDER_AUTH_FAILED";
    throw error;
  }
  return nextUrl;
};

const getAuthorizationCode = async (config, authorizeUrl) => {
  let response = await identityRequest(authorizeUrl);
  let nextUrl = await responseLocation(response, authorizeUrl);

  for (let hop = 0; nextUrl && hop < 10; hop += 1) {
    if (nextUrl.origin === new URL(config.redirectUri).origin) return nextUrl;
    if (/\/account\/login$/i.test(nextUrl.pathname)) {
      nextUrl = await loginFormRequest(nextUrl, config);
      continue;
    }
    response = await identityRequest(nextUrl);
    nextUrl = await responseLocation(response, nextUrl);
  }
  throw new Error("Luồng đăng nhập Datagate không trả về authorization code");
};

const loginForAccessToken = async (config) => {
  const verifier = crypto.randomBytes(64).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(24).toString("base64url");
  const authorizeUrl = new URL("/connect/authorize", config.identityUrl);
  authorizeUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scope,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    nonce: crypto.randomBytes(24).toString("base64url"),
  }).toString();

  const callbackUrl = await getAuthorizationCode(config, authorizeUrl);
  const code = callbackUrl.searchParams.get("code");
  if (!code || callbackUrl.searchParams.get("state") !== state) {
    throw new Error("Authorization code Datagate không hợp lệ");
  }

  const tokenResponse = await fetch(new URL("/connect/token", config.identityUrl), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const payload = await tokenResponse.json();
  if (!tokenResponse.ok || !payload.access_token) {
    const error = new Error(`Không lấy được token Datagate${payload.error ? `: ${payload.error}` : ""}`);
    error.code = "PROVIDER_AUTH_FAILED";
    throw error;
  }

  cachedAccessToken = payload.access_token;
  cachedAccessTokenExpiresAt = getTokenExpiration(payload.access_token)
    || Date.now() + Number(payload.expires_in || 900) * 1000;
  return cachedAccessToken;
};

const getAccessToken = async (config) => {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + tokenRenewBeforeMs) {
    return cachedAccessToken;
  }
  const configuredTokenExpiresAt = getTokenExpiration(config.token);
  if (config.token && configuredTokenExpiresAt > Date.now() + tokenRenewBeforeMs) {
    cachedAccessToken = config.token;
    cachedAccessTokenExpiresAt = configuredTokenExpiresAt;
    return cachedAccessToken;
  }

  const error = new Error(config.username && config.password
    ? "Token Datagate đã hết hạn, hãy bấm tải lại để đăng nhập và lấy token mới"
    : "Nguồn Datagate chưa được cấu hình token hoặc tài khoản đăng nhập trên máy chủ");
  error.code = config.username && config.password ? "PROVIDER_TOKEN_EXPIRED" : "PROVIDER_NOT_CONFIGURED";
  throw error;
};

const refreshAccessToken = async () => {
  const config = getConfig();
  if (!config.username || !config.password) {
    const error = new Error("Nguồn Datagate chưa được cấu hình tài khoản đăng nhập trên máy chủ");
    error.code = "PROVIDER_NOT_CONFIGURED";
    throw error;
  }
  if (!loginPromise) {
    loginPromise = loginForAccessToken(config).finally(() => { loginPromise = null; });
  }
  await loginPromise;
  return { expiresAt: new Date(cachedAccessTokenExpiresAt).toISOString() };
};

const getAuthorizedConfig = async () => {
  const config = getConfig();
  if (!Number.isFinite(config.accountId)) {
    const error = new Error("Tài khoản Datagate không hợp lệ");
    error.code = "PROVIDER_NOT_CONFIGURED";
    throw error;
  }
  return { config, accessToken: await getAccessToken(config) };
};

const toVietnamTimestamp = (value) => {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizePoint = (site) => {
  const lastUpdate = toVietnamTimestamp(site.device?.lastCallIn);
  const lastUpdateTime = lastUpdate ? new Date(lastUpdate).getTime() : 0;
  const connected = lastUpdateTime > 0 && Date.now() - lastUpdateTime <= connectionTimeoutMs;
  const siteCode = String(site.siteID || site.id);
  const address = String(site.address || "").trim();

  return {
    number: String(site.id),
    name: address ? `${siteCode} - ${address}` : `Logger ${siteCode}`,
    group: String(site.device?.model || "Không có"),
    address: site.device?.smsNumber ? `SĐT: ${site.device.smsNumber}` : "",
    status: connected ? "SUCCESS" : "DISCONNECTED",
    connected,
    alertMessage: connected ? "" : "Không nhận dữ liệu trong 24 giờ",
    lastUpdate,
  };
};

const getInterval = (intervalMinutes) => {
  const minutes = Math.max(1, Math.min(Number(intervalMinutes) || 60, 1440));
  if (minutes <= 1) return "OneMinute";
  if (minutes <= 5) return "FiveMinutes";
  if (minutes <= 15) return "FifteenMinutes";
  if (minutes <= 30) return "ThirtyMinutes";
  if (minutes < 360) return "OneHour";
  if (minutes < 1440) return "SixHours";
  return "OneDay";
};

const intervalDurationMinutes = {
  OneMinute: 1,
  FiveMinutes: 5,
  FifteenMinutes: 15,
  ThirtyMinutes: 30,
  OneHour: 60,
  SixHours: 360,
  OneDay: 1440,
};

const formatDateTime = (value) => {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/);
  if (!match) throw new Error("Thời gian không hợp lệ");
  return `${match[1]}T${match[2]}:${match[3] || "00"}`;
};

const downsampleRecords = (records, intervalMinutes) => {
  const interval = Math.max(1, Math.min(Number(intervalMinutes) || 1, 1440));
  if (interval <= 60 || !records.length) {
    return records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  const buckets = new Map();
  records.forEach((record) => {
    const time = new Date(record.timestamp).getTime();
    if (!Number.isFinite(time)) return;
    const bucketSize = interval * 60000;
    const bucketTime = Math.floor((time + vietnamOffsetMs) / bucketSize) * bucketSize - vietnamOffsetMs;
    const bucket = buckets.get(bucketTime) || {};
    Object.entries(record.values || {}).forEach(([key, value]) => {
      if (!Number.isFinite(Number(value))) return;
      const stat = bucket[key] || { total: 0, count: 0, latest: null, latestTime: -Infinity };
      stat.total += Number(value);
      stat.count += 1;
      if (time >= stat.latestTime) {
        stat.latest = Number(value);
        stat.latestTime = time;
      }
      bucket[key] = stat;
    });
    buckets.set(bucketTime, bucket);
  });

  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([time, bucket]) => ({
    timestamp: new Date(time).toISOString(),
    values: Object.fromEntries(Object.entries(bucket).map(([key, stat]) => [
      key,
      key === "meter" ? stat.latest : Number((stat.total / stat.count).toFixed(3)),
    ])),
  }));
};

const normalizeGraph = (payload, number, intervalMinutes, apiInterval) => {
  const site = (payload?.data || []).find((item) => String(item.siteId) === String(number)) || payload?.data?.[0];
  if (!site) return { number: String(number), name: `Logger ${number}`, channels: [], records: [] };

  const recordsByTime = new Map();
  const channels = [];
  (site.channelData || []).forEach((channel) => {
    const type = String(channel.type || "").toLowerCase();
    const key = type === "pressure" ? "pressure" : type === "flow" ? "flow" : null;
    if (!key) return;
    channels.push({
      key,
      label: key === "pressure" ? "Áp suất" : "Lưu lượng",
      unit: key === "pressure" ? "m" : "m³/h",
    });

    (channel.data || []).forEach((point) => {
      const timestamp = toVietnamTimestamp(point.date);
      const value = Number(point.value);
      if (!timestamp || !Number.isFinite(value)) return;
      const record = recordsByTime.get(timestamp) || { timestamp, values: {} };
      record.values[key] = value;
      if (key === "flow" && Number.isFinite(Number(point.meterValue))) {
        record.values.meter = Number(point.meterValue);
      }
      recordsByTime.set(timestamp, record);
    });
  });

  return {
    number: String(number),
    name: site.address ? `${site.name} - ${site.address}` : String(site.name || `Logger ${number}`),
    channels,
    records: Number(intervalMinutes) > intervalDurationMinutes[apiInterval]
      ? downsampleRecords([...recordsByTime.values()], intervalMinutes)
      : [...recordsByTime.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
  };
};

export const datagateProvider = {
  id: providerId,
  name: providerName,
  paginated: true,
  pageSize: 20,
  manualAuthRefresh: true,
  isConfigured: () => {
    const config = getConfig();
    return Boolean((config.token || (config.username && config.password)) && Number.isFinite(config.accountId));
  },

  refreshAccessToken,

  async getPoints({ page = 1, pageSize = 20, search = "" } = {}) {
    const { config, accessToken } = await getAuthorizedConfig();
    const currentPage = Math.max(1, Number(page) || 1);
    const normalizedPageSize = Math.max(1, Math.min(Number(pageSize) || 20, 50));
    const response = await axios.get(`${config.baseUrl}/sites`, {
      ...requestConfig(config, accessToken),
      params: {
        currentPage,
        accountId: config.accountId,
        search: String(search || "").trim(),
        sortOrder: "Ascending",
        columnSort: "Location",
        searchType: "Address",
        zone: "",
        filterType: "All",
        pageSize: normalizedPageSize,
      },
    });
    const payload = response.data || {};
    const points = (payload.items || []).map(normalizePoint);
    const total = Number(payload.itemsTotal || 0);
    const returnedPage = Number(payload.currentPage || currentPage);
    const returnedPageSize = Number(payload.pageSize || normalizedPageSize);

    return {
      points,
      pagination: {
        page: returnedPage,
        pageSize: returnedPageSize,
        total,
        hasMore: returnedPage * returnedPageSize < total,
      },
    };
  },

  async getLoggerData({ number, fromDate, toDate, intervalMinutes }) {
    const { config, accessToken } = await getAuthorizedConfig();
    const apiInterval = getInterval(intervalMinutes);
    const response = await axios.post(
      `${config.baseUrl}/graph`,
      {
        from: formatDateTime(fromDate),
        to: formatDateTime(toDate),
        interval: apiInterval,
        dataType: "Primary",
        units: {
          Pressure: { name: "m", interval: null },
          Flow: { name: "m³", interval: "Hour" },
        },
      },
      {
        ...requestConfig(config, accessToken),
        params: { siteIds: number },
        headers: {
          ...requestConfig(config, accessToken).headers,
          "content-type": "application/json",
        },
      }
    );
    return normalizeGraph(response.data, number, intervalMinutes, apiInterval);
  },
};
