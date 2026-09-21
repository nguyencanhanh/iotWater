const toInt = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
};

const toBool = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
};

const toList = (value, fallback) => {
  const list = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
};

const stripTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const aiConfig = {
  primaryProvider: (process.env.AI_PRIMARY_PROVIDER || "web2api").trim(),
  fallbackProviders: toList(process.env.AI_FALLBACK_PROVIDERS, ["ollama"]),
  maxConcurrency: toInt(process.env.AI_MAX_CONCURRENCY, 2),
  queueLimit: toInt(process.env.AI_QUEUE_LIMIT, 12),
  queueWaitMs: toInt(process.env.AI_QUEUE_WAIT_MS, 20000),
  retryAttempts: toInt(process.env.AI_RETRY_ATTEMPTS, 2),
  retryBaseDelayMs: toInt(process.env.AI_RETRY_BASE_DELAY_MS, 700),
  retryMaxDelayMs: toInt(process.env.AI_RETRY_MAX_DELAY_MS, 6000),
  breakerFailureThreshold: toInt(process.env.AI_BREAKER_FAILURE_THRESHOLD, 5),
  breakerResetMs: toInt(process.env.AI_BREAKER_RESET_MS, 60000),
  cacheEnabled: toBool(process.env.AI_CACHE_ENABLED, true),
  cacheTtlSeconds: toInt(process.env.AI_CACHE_TTL_SECONDS, 900),
  cachePrefix: process.env.AI_CACHE_PREFIX || "ai:cache:",
  logRequests: toBool(process.env.AI_LOG_REQUESTS, true),
};

export const providerConfig = {
  web2api: {
    name: "web2api",
    baseUrl: stripTrailingSlash(process.env.GEMINI_WEB2API_BASE_URL || "http://127.0.0.1:8081/v1"),
    apiKey: process.env.GEMINI_WEB2API_API_KEY || "sk-gemini",
    model: process.env.GEMINI_WEB2API_MODEL || "gemini-3.5-flash",
    timeoutMs: toInt(process.env.GEMINI_WEB2API_TIMEOUT_MS, 90000),
    supportsLongForm: true,
  },
  gemini: {
    name: "gemini",
    baseUrl: stripTrailingSlash(
      process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai"
    ),
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_API_MODEL || "gemini-2.5-flash",
    timeoutMs: toInt(process.env.GEMINI_API_TIMEOUT_MS, 90000),
    supportsLongForm: true,
  },
  ollama: {
    name: "ollama",
    baseUrl: stripTrailingSlash(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1"),
    apiKey: process.env.OLLAMA_API_KEY || "ollama",
    model: process.env.OLLAMA_MODEL || "llama3.1:8b",
    timeoutMs: toInt(process.env.OLLAMA_TIMEOUT_MS, 120000),
    supportsLongForm: false,
  },
};

export const isProviderConfigured = (name) => {
  const provider = providerConfig[name];
  if (!provider) return false;
  if (name === "gemini") return Boolean(provider.apiKey);
  return Boolean(provider.baseUrl);
};

export const resolveProviderChain = ({ longForm = false } = {}) => {
  const chain = [aiConfig.primaryProvider, ...aiConfig.fallbackProviders];
  return [...new Set(chain)]
    .filter((name) => isProviderConfigured(name))
    .filter((name) => (longForm ? providerConfig[name].supportsLongForm : true));
};
