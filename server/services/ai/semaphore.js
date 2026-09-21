import { aiConfig } from "./config.js";

let active = 0;
const waiters = [];

export class AiBusyError extends Error {
  constructor(message = "AI đang bận, vui lòng thử lại sau ít giây") {
    super(message);
    this.name = "AiBusyError";
    this.statusCode = 503;
    this.retryable = true;
  }
}

const release = () => {
  active -= 1;
  const next = waiters.shift();
  if (!next) return;
  clearTimeout(next.timer);
  active += 1;
  next.resolve(release);
};

export const acquireSlot = () => new Promise((resolve, reject) => {
  if (active < aiConfig.maxConcurrency) {
    active += 1;
    resolve(release);
    return;
  }

  if (waiters.length >= aiConfig.queueLimit) {
    reject(new AiBusyError("Hàng đợi AI đã đầy, vui lòng thử lại sau"));
    return;
  }

  const waiter = { resolve, reject };
  waiter.timer = setTimeout(() => {
    const index = waiters.indexOf(waiter);
    if (index !== -1) waiters.splice(index, 1);
    reject(new AiBusyError("Chờ lượt AI quá lâu, vui lòng thử lại sau"));
  }, aiConfig.queueWaitMs);

  waiters.push(waiter);
});

export const getQueueSnapshot = () => ({
  active,
  waiting: waiters.length,
  maxConcurrency: aiConfig.maxConcurrency,
  queueLimit: aiConfig.queueLimit,
});
