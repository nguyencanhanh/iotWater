import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaExclamationTriangle, FaTimes } from "react-icons/fa";
import { monitorTickerGet } from "../../api";

const POLL_MS = 60000;
const DISMISS_KEY = "iot.monitorTickerDismissed";
export const TICKER_REFRESH_EVENT = "iot:monitor-ticker-refresh";

// Dong chu chay tren dau trang: cac bat thuong DANG dien ra do giam sat AI phat hien.
// Bat/tat chung o trang Giam sat AI; nut x chi an tam tren may nay cho toi khi co su kien moi.
const MonitorTicker = ({ user }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await monitorTickerGet(localStorage.getItem("token"), user);
        if (alive) setItems(res.data?.enabled ? res.data.items || [] : []);
      } catch {
        // Loi mang thi giu nguyen noi dung cu, lan sau thu lai.
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    // Trang Giam sat AI phat su kien nay khi doi cai dat -> cap nhat ngay, khong doi 60 giay.
    window.addEventListener(TICKER_REFRESH_EVENT, load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(TICKER_REFRESH_EVENT, load);
    };
  }, [user]);

  const signature = useMemo(() => items.map((item) => item.id).join(","), [items]);
  if (!items.length || dismissed === signature) return null;

  const hasHigh = items.some((item) => item.level === "cao");
  const text = items.map((item) => `${item.level === "cao" ? "🔴" : "🟠"} ${item.text}`).join("      •      ");
  // Toc do doc duoc ~ 90 px/giay bat ke noi dung dai hay ngan.
  const duration = Math.max(20, Math.round(text.length * 0.18));

  const dismiss = () => {
    setDismissed(signature);
    try {
      sessionStorage.setItem(DISMISS_KEY, signature);
    } catch {
      // Khong luu duoc thi chi an trong lan hien thi nay.
    }
  };

  // pl-14: chua cho nut mo menu (co dinh o goc trai tren) khong de len chu.
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex h-9 items-center gap-2 overflow-hidden pl-14 pr-3 text-[15px] font-bold text-white shadow ${hasHigh ? "bg-rose-600" : "bg-amber-500"}`}
    >
      <button
        type="button"
        onClick={() => navigate("/admin-dashboard/monitor")}
        className="flex shrink-0 items-center gap-1.5 rounded bg-black/20 px-2 py-0.5 text-xs font-black uppercase tracking-wide hover:bg-black/30"
        title="Mở trang Giám sát AI"
      >
        <FaExclamationTriangle /> Giám sát AI · {items.length}
      </button>
      <button
        type="button"
        onClick={() => navigate("/admin-dashboard/monitor")}
        className="iot-ticker relative min-w-0 flex-1 overflow-hidden text-left"
        title={text}
      >
        <span className="iot-ticker__text" style={{ animationDuration: `${duration}s` }}>{text}</span>
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-black/20"
        title="Tạm ẩn cho tới khi có bất thường mới"
        aria-label="Tạm ẩn dòng chữ giám sát"
      >
        <FaTimes />
      </button>
    </div>
  );
};

export default MonitorTicker;
