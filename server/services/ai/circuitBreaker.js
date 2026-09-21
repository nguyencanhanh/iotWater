import { aiConfig } from "./config.js";

const breakers = new Map();

const getBreaker = (key) => {
  if (!breakers.has(key)) {
    breakers.set(key, { failures: 0, openedAt: 0, state: "closed" });
  }
  return breakers.get(key);
};

export const isBreakerOpen = (key) => {
  const breaker = getBreaker(key);
  if (breaker.state !== "open") return false;
  if (Date.now() - breaker.openedAt >= aiConfig.breakerResetMs) {
    breaker.state = "half-open";
    return false;
  }
  return true;
};

export const recordBreakerSuccess = (key) => {
  const breaker = getBreaker(key);
  breaker.failures = 0;
  breaker.openedAt = 0;
  breaker.state = "closed";
};

export const recordBreakerFailure = (key) => {
  const breaker = getBreaker(key);
  breaker.failures += 1;
  if (breaker.state === "half-open" || breaker.failures >= aiConfig.breakerFailureThreshold) {
    breaker.state = "open";
    breaker.openedAt = Date.now();
    breaker.failures = aiConfig.breakerFailureThreshold;
  }
};

export const getBreakerSnapshot = () => Object.fromEntries(
  [...breakers.entries()].map(([key, breaker]) => [
    key,
    {
      state: isBreakerOpen(key) ? "open" : breaker.state,
      failures: breaker.failures,
      retryInMs: breaker.state === "open"
        ? Math.max(aiConfig.breakerResetMs - (Date.now() - breaker.openedAt), 0)
        : 0,
    },
  ])
);
