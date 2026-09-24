import cron from "node-cron";
import { getState, runCheck } from "./engine.js";
import { runDailyReports, runNightFlowCheck } from "./daily.js";

// Bat bang MONITOR_ENABLED=1 trong .env. Nhieu tien trinh cung bat van an toan vi
// moi luot deu phai giu khoa trong MonitorState (chi 1 tien trinh chay).
const safely = (name, job) => async () => {
  try {
    // Cong tac tong tren trang Giam sat AI: tat thi bo qua moi lich.
    const state = await getState();
    if (state?.active === false) return;
    const result = await job();
    if (result?.skipped) return;
    console.log(`[monitor] ${name}:`, JSON.stringify(result));
  } catch (error) {
    console.error(`[monitor] ${name} lỗi:`, error.message);
  }
};

export const startMonitor = () => {
  if (process.env.MONITOR_ENABLED !== "1") return false;
  const options = { timezone: "Asia/Ho_Chi_Minh" };
  cron.schedule("*/15 * * * *", safely("check", () => runCheck()), options);
  cron.schedule("30 5 * * *", safely("night-flow", () => runNightFlowCheck()), options);
  cron.schedule("0 7 * * *", safely("daily-report", () => runDailyReports()), options);
  console.log("[monitor] Giám sát AI 24/7 đã bật (15 phút/lượt, lưu lượng đêm 5h30, báo cáo 7h)");
  return true;
};
