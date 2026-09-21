import { clientRedis } from "../../mqtt/redis.js";

const SESSION_PREFIX = "agent:session:";
const SESSION_TTL_SECONDS = Number(process.env.AGENT_SESSION_TTL_SECONDS) || 1800;
const MAX_TURNS = 6;

const memoryStore = new Map();

const isRedisReady = () => Boolean(clientRedis?.isOpen);

const buildKey = (userId, sessionId) => `${SESSION_PREFIX}${userId}:${sessionId || "default"}`;

const readMemory = (key) => {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
};

const writeMemory = (key, value) => {
  memoryStore.set(key, { value, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
  if (memoryStore.size > 500) {
    const oldest = memoryStore.keys().next().value;
    memoryStore.delete(oldest);
  }
};

export const loadSession = async (userId, sessionId) => {
  const key = buildKey(userId, sessionId);
  if (isRedisReady()) {
    try {
      const raw = await clientRedis.get(key);
      if (raw) return JSON.parse(raw);
    } catch (error) {
      console.error("[agent] load session failed:", error.message);
    }
  }
  return readMemory(key) || { slots: {}, turns: [] };
};

export const saveSession = async (userId, sessionId, session) => {
  const key = buildKey(userId, sessionId);
  const trimmed = {
    slots: session.slots || {},
    turns: (session.turns || []).slice(-MAX_TURNS),
  };

  writeMemory(key, trimmed);
  if (!isRedisReady()) return;

  try {
    await clientRedis.set(key, JSON.stringify(trimmed), { EX: SESSION_TTL_SECONDS });
  } catch (error) {
    console.error("[agent] save session failed:", error.message);
  }
};

export const appendTurn = (session, role, content) => {
  session.turns = [...(session.turns || []), { role, content: String(content || "").slice(0, 600) }].slice(-MAX_TURNS);
  return session;
};

export const rememberSlots = (session, slots) => {
  session.slots = {
    ...(session.slots || {}),
    ...Object.fromEntries(Object.entries(slots).filter(([, value]) => value !== null && value !== undefined && value !== "")),
  };
  return session;
};
