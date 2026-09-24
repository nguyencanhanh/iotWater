import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import {
  FaBroadcastTower,
  FaCheck,
  FaFileAlt,
  FaHistory,
  FaListUl,
  FaPaperPlane,
  FaPlay,
  FaRobot,
  FaSyncAlt,
  FaTelegramPlane,
  FaTimes,
} from "react-icons/fa";
import { useAuth } from "../context/authContext";
import {
  monitorEventsGet,
  monitorFeedbackPost,
  monitorLoggerModePut,
  monitorLoggersGet,
  monitorOverviewGet,
  monitorReportPost,
  monitorReportsGet,
  monitorRunPost,
  monitorSettingsPut,
  monitorTestTelegramPost,
} from "../api";

const AiMarkdown = lazy(() => import("../components/ai/AiMarkdown"));
// Trung ten voi TICKER_REFRESH_EVENT trong MonitorTicker (khong import de khong keo component vao chunk nay).
const TICKER_REFRESH_EVENT = "iot:monitor-ticker-refresh";

const token = () => localStorage.getItem("token");

const LEVEL_STYLE = {
  cao: "border-rose-200 bg-rose-50 text-rose-700",
  "trung bình": "border-amber-200 bg-amber-50 text-amber-700",
  "thấp": "border-slate-200 bg-slate-50 text-slate-600",
};
const LEVEL_LABEL = { cao: "Cao", "trung bình": "Trung bình", "thấp": "Thấp" };
const MODE_OPTIONS = [
  { value: "on", label: "Theo dõi + thông báo" },
  { value: "report", label: "Chỉ ghi báo cáo" },
  { value: "off", label: "Tắt" },
];

const formatTime = (value) => (value
  ? new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
  : "—");

const durationText = (from, to) => {
  const minutes = Math.max(0, Math.round((new Date(to || Date.now()) - new Date(from)) / 60000));
  if (minutes < 60) return `${minutes} phút`;
  const hours = minutes / 60;
  return hours < 48 ? `${hours.toFixed(1)} giờ` : `${(hours / 24).toFixed(1)} ngày`;
};

const Switch = ({ checked, onChange, disabled, label, hint, icon }) => (
  <label className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="text-lg text-teal-600">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-800">{label}</span>
        {hint && <span className="block text-xs font-semibold text-slate-500">{hint}</span>}
      </span>
    </span>
    <input
      type="checkbox"
      className="peer sr-only"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-teal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-300 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
  </label>
);

const EventCard = ({ event, canReview, onFeedback }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-black ${LEVEL_STYLE[event.level] || LEVEL_STYLE["thấp"]}`}>
        {LEVEL_LABEL[event.level] || event.level}
      </span>
      <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">{event.kindLabel}</span>
      {event.status === "open" ? (
        <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-black text-white">Đang diễn ra</span>
      ) : (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Đã hết</span>
      )}
      {event.mode === "report" && (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Chỉ ghi báo cáo</span>
      )}
      {event.notifiedAt && (
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
          <FaTelegramPlane /> Đã gửi
        </span>
      )}
    </div>
    <div className="mt-1.5 text-sm font-black text-slate-900">
      {event.sensorName} <span className="font-semibold text-slate-400">({event.sensorId})</span>
      {event.group && <span className="text-xs font-semibold text-slate-500"> · {event.group}</span>}
    </div>
    <p className="mt-0.5 text-sm leading-5 text-slate-700">{event.message}</p>
    <div className="mt-1 text-xs font-semibold text-slate-500">
      Bắt đầu {formatTime(event.startAt)}
      {event.status === "closed" ? ` · kết thúc ${formatTime(event.endAt)}` : ""}
      {` · kéo dài ${durationText(event.startAt, event.status === "closed" ? event.endAt : null)}`}
    </div>

    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {event.feedback ? (
        <>
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black ${event.feedback === "confirmed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {event.feedback === "confirmed" ? <><FaCheck /> Xác nhận đúng</> : <><FaTimes /> Báo nhầm</>}
            {event.feedbackBy ? ` · ${event.feedbackBy}` : ""}
          </span>
          {canReview && (
            <button type="button" onClick={() => onFeedback(event, null)} className="text-xs font-bold text-slate-500 hover:underline">
              Bỏ đánh giá
            </button>
          )}
        </>
      ) : canReview ? (
        <>
          <button
            type="button"
            onClick={() => onFeedback(event, "confirmed")}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
          >
            <FaCheck /> Đúng, có vấn đề
          </button>
          <button
            type="button"
            onClick={() => onFeedback(event, "false_alarm")}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <FaTimes /> Báo nhầm
          </button>
        </>
      ) : null}
    </div>
  </div>
);

const TABS = [
  { value: "open", label: "Đang diễn ra", icon: <FaBroadcastTower /> },
  { value: "history", label: "Lịch sử", icon: <FaHistory /> },
  { value: "reports", label: "Báo cáo sáng", icon: <FaFileAlt /> },
  { value: "loggers", label: "Logger", icon: <FaListUl /> },
];

const Monitor = () => {
  const { user } = useAuth();
  const userNumber = user?.user ?? 0;
  const isAdmin = user?.role === "admin";
  const canReview = user?.role !== "trial";

  const [tab, setTab] = useState("open");
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState({ events: [], total: 0 });
  const [historyLevel, setHistoryLevel] = useState("");
  const [reports, setReports] = useState([]);
  const [loggers, setLoggers] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ tone: "", text: "" });

  const flash = (tone, text) => setMessage({ tone, text });

  const loadOverview = useCallback(async () => {
    try {
      const res = await monitorOverviewGet(token(), userNumber);
      setOverview(res.data);
    } catch (error) {
      flash("error", error.response?.data?.error || "Không tải được trạng thái giám sát");
    }
  }, [userNumber]);

  const loadHistory = useCallback(async () => {
    const res = await monitorEventsGet(token(), { user: userNumber, level: historyLevel, limit: 200 });
    setHistory({ events: res.data?.events || [], total: res.data?.total || 0 });
  }, [userNumber, historyLevel]);

  const loadReports = useCallback(async () => {
    const res = await monitorReportsGet(token(), userNumber);
    setReports(res.data?.reports || []);
  }, [userNumber]);

  const loadLoggers = useCallback(async () => {
    const res = await monitorLoggersGet(token(), userNumber);
    setLoggers(res.data?.loggers || []);
  }, [userNumber]);

  useEffect(() => {
    loadOverview();
    const timer = setInterval(loadOverview, 60000);
    return () => clearInterval(timer);
  }, [loadOverview]);

  useEffect(() => {
    const loaders = { history: loadHistory, reports: loadReports, loggers: loadLoggers };
    loaders[tab]?.().catch((error) => flash("error", error.response?.data?.error || "Không tải được dữ liệu"));
  }, [tab, loadHistory, loadReports, loadLoggers]);

  const state = overview?.state;

  const run = async (key, job, successText) => {
    setBusy(key);
    setMessage({ tone: "", text: "" });
    try {
      await job();
      if (successText) flash("ok", successText);
    } catch (error) {
      flash("error", error.response?.data?.error || "Thao tác không thành công");
    } finally {
      setBusy("");
    }
  };

  const updateSetting = (patch) => run("settings", async () => {
    const res = await monitorSettingsPut(token(), { user: userNumber, ...patch });
    setOverview((prev) => ({ ...prev, state: res.data.state }));
    window.dispatchEvent(new Event(TICKER_REFRESH_EVENT));
  }, "Đã lưu cài đặt");

  const handleFeedback = (event, verdict) => run(`fb-${event._id}`, async () => {
    const res = await monitorFeedbackPost(token(), event._id, { user: userNumber, verdict });
    const updated = res.data.event;
    setOverview((prev) => prev && ({ ...prev, open: prev.open.map((item) => (item._id === updated._id ? updated : item)) }));
    // Danh dau bao nham thi su kien roi khoi dong chu chay.
    window.dispatchEvent(new Event(TICKER_REFRESH_EVENT));
    setHistory((prev) => ({ ...prev, events: prev.events.map((item) => (item._id === updated._id ? updated : item)) }));
  });

  const handleMode = (logger, mode) => run(`mode-${logger.id}`, async () => {
    await monitorLoggerModePut(token(), logger.id, { user: userNumber, mode });
    setLoggers((prev) => prev.map((item) => (item.id === logger.id ? { ...item, mode } : item)));
  }, `Đã đổi chế độ ${logger.name}`);

  const openEvents = overview?.open || [];
  const lastRunText = state?.lastRunAt ? `${formatTime(state.lastRunAt)} (${state.lastRunMs} ms)` : "chưa chạy";
  const loggerStats = useMemo(() => ({
    watching: loggers.filter((item) => item.mode !== "off" && item.enoughData).length,
    skipped: loggers.filter((item) => item.mode !== "off" && !item.enoughData).length,
  }), [loggers]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">Giám sát AI 24/7</div>
            <h1 className="text-xl font-black text-slate-900">Theo dõi bất thường mạng lưới</h1>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              Mỗi 15 phút so số đo của từng logger với mức bình thường cùng khung giờ (28 ngày). 5h30 kiểm tra lưu lượng đêm, 7h gửi báo cáo.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => loadOverview()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <FaSyncAlt /> Tải lại
            </button>
            {isAdmin && (
              <button
                type="button"
                disabled={busy === "run"}
                onClick={() => run("run", async () => { await monitorRunPost(token(), { user: userNumber }); await loadOverview(); }, "Đã chạy một lượt kiểm tra")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                <FaPlay className={busy === "run" ? "animate-pulse" : ""} /> Kiểm tra ngay
              </button>
            )}
          </div>
        </div>

        <div className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${state?.active === false ? "border-slate-300 bg-slate-100" : "border-teal-200 bg-teal-50"}`}>
          <div className="min-w-0">
            <div className={`text-sm font-black ${state?.active === false ? "text-slate-600" : "text-teal-800"}`}>
              {!state ? "Đang tải…" : state.active === false ? "Giám sát đang TẮT" : "Giám sát đang BẬT"}
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {state?.active === false
                ? "Không kiểm tra, không báo cáo, không nhắn tin. Lịch sử cũ vẫn giữ nguyên."
                : "Tự kiểm tra 15 phút/lần, 5h30 kiểm tra lưu lượng đêm, 7h tạo báo cáo."}
            </div>
          </div>
          <button
            type="button"
            disabled={!isAdmin || busy === "settings" || !state}
            onClick={() => updateSetting({ active: state?.active === false })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black text-white shadow disabled:opacity-60 ${state?.active === false ? "bg-teal-600 hover:bg-teal-700" : "bg-rose-600 hover:bg-rose-700"}`}
          >
            {state?.active === false ? "Bật giám sát" : "Tắt giám sát"}
          </button>
        </div>

        {state && !state.enabled && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            Bộ giám sát chưa được bật trên máy chủ (MONITOR_ENABLED). Các số liệu dưới đây có thể đã cũ.
          </div>
        )}

        {state?.widespreadSince && (
          <div className="mt-3 rounded-xl border border-rose-300 bg-rose-600 px-3 py-2 text-sm font-bold text-white">
            Mất dữ liệu diện rộng: {state.widespreadCount} logger không gửi dữ liệu từ {formatTime(state.widespreadSince)}.
            Nhiều khả năng do máy chủ, MQTT hoặc đường mạng, không phải sự cố tại từng điểm.
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Mức cao đang diễn ra</div>
            <div className="text-xl font-black text-rose-700">{overview?.counts?.high ?? "—"}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Tổng đang diễn ra</div>
            <div className="text-xl font-black text-amber-700">{overview?.counts?.open ?? "—"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phát hiện trong 24 giờ</div>
            <div className="text-xl font-black text-slate-800">{overview?.counts?.last24h ?? "—"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lượt kiểm tra gần nhất</div>
            <div className="truncate text-sm font-black text-slate-800">{lastRunText}</div>
            {state?.lastError && <div className="truncate text-[11px] font-bold text-rose-600">Lỗi: {state.lastError}</div>}
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <Switch
            icon={<FaBroadcastTower />}
            label="Dòng chữ chạy trên đầu trang"
            hint="Hiện các bất thường đang diễn ra cho mọi người đang mở web"
            checked={Boolean(state) && state.ticker !== false}
            disabled={!isAdmin || busy === "settings" || !state}
            onChange={(value) => updateSetting({ ticker: value })}
          />
          <Switch
            icon={<FaTelegramPlane />}
            label="Gửi Telegram"
            hint={state?.telegramConfigured === false
              ? "Máy chủ chưa cấu hình bot Telegram"
              : "Chỉ gửi mức Cao ngay khi phát hiện + báo cáo 7h sáng"}
            checked={Boolean(state?.notify)}
            disabled={!isAdmin || busy === "settings" || !state}
            onChange={(value) => updateSetting({ notify: value })}
          />
        </div>
        <div className="mt-2">
          <Switch
            icon={<FaRobot />}
            label="Dùng Gemini viết lời báo cáo sáng"
            hint="Tắt = báo cáo tự tạo hoàn toàn trên máy chủ, không gửi dữ liệu ra ngoài. Việc phát hiện bất thường luôn chạy tại máy chủ."
            checked={Boolean(state?.aiReport)}
            disabled={!isAdmin || busy === "settings" || !state}
            onChange={(value) => updateSetting({ aiReport: value })}
          />
        </div>
        {isAdmin && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy === "tg"}
              onClick={() => run("tg", () => monitorTestTelegramPost(token(), { user: userNumber }), "Đã gửi tin nhắn thử qua Telegram")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <FaPaperPlane /> Gửi thử Telegram
            </button>
          </div>
        )}

        {message.text && (
          <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-bold ${message.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {message.text}
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${tab === item.value ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {item.icon} {item.label}
            {item.value === "open" && openEvents.length > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] ${tab === "open" ? "bg-white text-teal-700" : "bg-rose-600 text-white"}`}>{openEvents.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "open" && (
        !overview ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-400">
            Đang tải…
          </div>
        ) : openEvents.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-bold text-emerald-700">
            Không có bất thường nào đang diễn ra.
          </div>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {openEvents.map((event) => (
              <EventCard key={event._id} event={event} canReview={canReview} onFeedback={handleFeedback} />
            ))}
          </div>
        )
      )}

      {tab === "history" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">
              {history.total} sự kiện{history.total > history.events.length ? ` · hiển thị ${history.events.length} mới nhất` : ""}
            </span>
            <select
              value={historyLevel}
              onChange={(event) => setHistoryLevel(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold"
            >
              <option value="">Mọi mức</option>
              <option value="cao">Cao</option>
              <option value="trung bình">Trung bình</option>
              <option value="thấp">Thấp (lặp lại)</option>
            </select>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {history.events.map((event) => (
              <EventCard key={event._id} event={event} canReview={canReview} onFeedback={handleFeedback} />
            ))}
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="space-y-3">
          {isAdmin && (
            <button
              type="button"
              disabled={busy === "report"}
              onClick={() => run("report", async () => {
                const before = reports[0]?._id;
                await monitorReportPost(token(), { user: userNumber });
                // Server viet bao cao o nen: hoi lai moi 5 giay, toi da 5 phut.
                for (let index = 0; index < 60; index += 1) {
                  await new Promise((resolve) => setTimeout(resolve, 5000));
                  const res = await monitorReportsGet(token(), userNumber);
                  const list = res.data?.reports || [];
                  if (list[0] && list[0]._id !== before) {
                    setReports(list);
                    return;
                  }
                }
                throw new Error("timeout");
              }, "Đã tạo báo cáo 24 giờ qua")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              <FaFileAlt className={busy === "report" ? "animate-pulse" : ""} />
              {busy === "report" ? "Đang tạo báo cáo…" : "Tạo báo cáo 24 giờ qua ngay"}
            </button>
          )}
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500">
              Chưa có báo cáo. Báo cáo tự tạo lúc 7h sáng mỗi ngày.
            </div>
          ) : reports.map((report) => (
            <article key={report._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
                <span>{formatTime(report.periodFrom)} → {formatTime(report.periodTo)}</span>
                <span>· {report.stats?.total ?? 0} sự kiện, {report.stats?.high ?? 0} mức cao</span>
                {report.sentAt && <span className="text-sky-700">· đã gửi Telegram</span>}
                <span>· {report.provider === "local" ? "tạo tại máy chủ" : `AI: ${report.provider}`}</span>
                {report.aiError && <span className="text-amber-700">· AI lỗi, dùng bản tự động</span>}
              </div>
              <Suspense fallback={<div className="text-xs text-slate-400">Đang hiển thị…</div>}>
                <AiMarkdown content={report.summary} className="text-sm leading-6 text-slate-700" />
              </Suspense>
            </article>
          ))}
        </div>
      )}

      {tab === "loggers" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 text-xs font-bold text-slate-500">
            {loggerStats.watching} logger đang được theo dõi · {loggerStats.skipped} logger bỏ qua vì chưa đủ dữ liệu (dưới 20% số giờ trong 28 ngày)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-2">Logger</th>
                  <th className="py-2 pr-2">Nhóm</th>
                  <th className="py-2 pr-2 text-right">Dữ liệu 28 ngày</th>
                  <th className="py-2 pr-2 text-center">Đang có</th>
                  <th className="py-2">Chế độ</th>
                </tr>
              </thead>
              <tbody>
                {loggers.map((logger) => (
                  <tr key={logger.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 font-bold text-slate-800">
                      {logger.name} <span className="font-semibold text-slate-400">({logger.id})</span>
                      {!logger.hasFlow && logger.enoughData && <span className="ml-1 text-[11px] font-semibold text-slate-400">· chỉ đo áp</span>}
                    </td>
                    <td className="py-2 pr-2 text-slate-600">{logger.group}</td>
                    <td className={`py-2 pr-2 text-right font-bold ${logger.enoughData ? "text-slate-700" : "text-amber-600"}`}>
                      {logger.coverage}%{!logger.enoughData && " · bỏ qua"}
                    </td>
                    <td className="py-2 pr-2 text-center">
                      {logger.open > 0 ? <span className="rounded-full bg-rose-600 px-2 text-xs font-black text-white">{logger.open}</span> : "—"}
                    </td>
                    <td className="py-2">
                      <select
                        value={logger.mode}
                        disabled={!isAdmin || busy === `mode-${logger.id}`}
                        onChange={(event) => handleMode(logger, event.target.value)}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold disabled:opacity-60"
                      >
                        {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Monitor;
