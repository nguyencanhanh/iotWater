import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaChartArea,
  FaExclamationTriangle,
  FaListUl,
  FaLock,
  FaPaperPlane,
  FaPlus,
  FaRobot,
  FaTachometerAlt,
  FaUser,
  FaWater,
} from "react-icons/fa";
import { chatbotMessagePost } from "../api";
import { useAuth } from "../context/authContext";
import PayloadRenderer, { CopyButton } from "../components/ai/chat/payloads";
import { CAPABILITY_GROUPS, QUICK_PROMPTS, WELCOME_TEXT } from "../components/ai/chat/capabilities";
import { formatClock } from "../components/ai/chat/format";

const ICONS = {
  gauge: FaTachometerAlt,
  alert: FaExclamationTriangle,
  chart: FaChartArea,
  water: FaWater,
  list: FaListUl,
};

const TONE_ICON = {
  teal: "bg-teal-50 text-teal-600",
  rose: "bg-rose-50 text-rose-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-600",
};

const SOURCE_LABEL = {
  rules: "Khớp quy tắc",
  ai: "Hiểu bằng AI",
  heuristic: "Đoán theo từ khóa",
};

const newSessionId = () => `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Giu nguyen 1 sessionId trong suot phien de backend nho ngu canh hoi tiep.
const getSessionId = () => {
  try {
    const existing = sessionStorage.getItem("chatbotSessionId");
    if (existing) return existing;
    const created = newSessionId();
    sessionStorage.setItem("chatbotSessionId", created);
    return created;
  } catch {
    return "default";
  }
};

const greeting = () => ({ role: "assistant", content: WELCOME_TEXT, at: Date.now(), welcome: true });

/* ------------------------------ Thanh nang luc ------------------------------ */

const CapabilityRail = ({ onPick, disabled }) => (
  <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 px-4 py-3">
      <h2 className="text-sm font-black text-slate-900">Trợ lý làm được gì</h2>
      <p className="mt-0.5 text-xs font-semibold text-slate-500">Bấm một câu mẫu để hỏi ngay</p>
    </div>

    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
      {CAPABILITY_GROUPS.map((group) => {
        const Icon = ICONS[group.icon] || FaListUl;
        return (
          <div key={group.key}>
            <div className="flex items-center gap-2 px-1">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_ICON[group.tone]}`}>
                <Icon className="text-xs" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-slate-800">{group.title}</span>
              </span>
            </div>
            <div className="mt-1.5 space-y-1">
              {group.samples.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(sample)}
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-600 transition hover:bg-teal-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>

    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
        <FaLock className="text-teal-600" /> Chỉ đọc dữ liệu
      </div>
      <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
        Mọi lệnh sửa, xóa, cài đặt hay gửi cấu hình xuống thiết bị đều bị chặn ở backend.
      </p>
    </div>
  </div>
);

/* ------------------------------ Man hinh chao ------------------------------ */

const WelcomeBoard = ({ onPick, disabled }) => (
  <div className="mx-auto max-w-3xl">
    <div className="grid gap-2 sm:grid-cols-2">
      {CAPABILITY_GROUPS.map((group) => {
        const Icon = ICONS[group.icon] || FaListUl;
        return (
          <button
            key={group.key}
            type="button"
            disabled={disabled}
            onClick={() => onPick(group.samples[0])}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md disabled:cursor-not-allowed"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONE_ICON[group.tone]}`}>
              <Icon />
            </span>
            <div className="mt-2.5 text-sm font-black text-slate-900">{group.title}</div>
            <div className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">{group.description}</div>
            <div className="mt-2 truncate text-[11px] font-bold text-teal-700">“{group.samples[0]}”</div>
          </button>
        );
      })}
    </div>
  </div>
);

/* ------------------------------ Mot luot hoi dap ------------------------------ */

const MessageRow = ({ message, onQuickAsk, onOpen }) => {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[min(680px,85%)] rounded-2xl rounded-br-md bg-teal-600 px-4 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <div className="mt-1 text-right text-[10px] font-bold text-teal-100/80">{formatClock(message.at)}</div>
        </div>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
          <FaUser className="text-xs" />
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white ${message.error ? "bg-rose-500" : "bg-slate-900"}`}>
        <FaRobot className="text-xs" />
      </span>

      <div className="min-w-0 max-w-[min(920px,calc(100%-2.5rem))] flex-1">
        <div className={`rounded-2xl rounded-tl-md border px-4 py-2.5 text-sm font-semibold leading-6 shadow-sm ${
          message.error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-800"
        }`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <span>{formatClock(message.at)}</span>
            {message.source && SOURCE_LABEL[message.source] && (
              <>
                <span>·</span>
                <span>{SOURCE_LABEL[message.source]}</span>
              </>
            )}
            {message.cached && <><span>·</span><span>từ bộ nhớ đệm</span></>}
            {message.aiUsage && (
              <>
                <span>·</span>
                <span>còn {message.aiUsage.remaining}/{message.aiUsage.limit} lượt AI hôm nay</span>
              </>
            )}
            <span className="ml-auto"><CopyButton text={message.content} label="" /></span>
          </div>
        </div>

        <PayloadRenderer payload={message.payload} onQuickAsk={onQuickAsk} onOpen={onOpen} />
      </div>
    </div>
  );
};

const TypingRow = () => (
  <div className="flex gap-2">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
      <FaRobot className="text-xs" />
    </span>
    <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="flex gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="text-xs font-bold text-slate-500">Đang đọc câu lệnh và truy vấn dữ liệu…</span>
    </div>
  </div>
);

/* ------------------------------ Trang ------------------------------ */

const MAX_MESSAGE_LENGTH = 1000;

const Chatbot = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentUser = Number.isFinite(Number(user?.user)) ? Number(user.user) : 0;

  const sessionIdRef = useRef(getSessionId());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const [messages, setMessages] = useState([greeting()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const isEmpty = useMemo(() => messages.length === 1 && messages[0].welcome, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const sendMessage = async (overrideText) => {
    const text = String(overrideText ?? input).trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text, at: Date.now() }]);
    setLoading(true);

    try {
      const res = await chatbotMessagePost(localStorage.getItem("token"), {
        message: text,
        user: currentUser,
        sessionId: sessionIdRef.current,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.reply || "Mình đã xử lý yêu cầu.",
          payload: res.data.payload,
          aiUsage: res.data.aiUsage,
          source: res.data.source,
          cached: res.data.cached,
          at: Date.now(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error.response?.data?.error || "Trợ lý chưa xử lý được yêu cầu này. Bạn thử diễn đạt lại hoặc nêu rõ tên/ID logger nhé.",
          error: true,
          at: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleQuickAsk = (text) => {
    sendMessage(text);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    if (loading) return;
    const created = newSessionId();
    sessionIdRef.current = created;
    try {
      sessionStorage.setItem("chatbotSessionId", created);
    } catch {
      // sessionStorage bi chan thi van chat duoc, chi la khong nho qua lan tai lai trang.
    }
    setMessages([greeting()]);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full min-h-[560px] flex-col bg-slate-100 p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-teal-300">
            <FaRobot />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black text-slate-900">Trợ lý vận hành</h1>
            <p className="truncate text-xs font-semibold text-slate-500">
              Tổng quan hệ thống · Sự cố &amp; cảnh báo · Báo cáo &amp; so sánh · Thất thoát DMA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700 sm:inline-flex">
            <FaLock /> Chỉ đọc
          </span>
          <button
            type="button"
            onClick={startNewChat}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaPlus /> Hội thoại mới
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[264px_1fr]">
        <aside className="hidden min-h-0 xl:block">
          <CapabilityRail onPick={handleQuickAsk} disabled={loading} />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            <div className="mx-auto max-w-5xl space-y-4">
              {messages.map((message, index) => (
                <MessageRow
                  key={`${message.role}-${index}-${message.at}`}
                  message={message}
                  onQuickAsk={handleQuickAsk}
                  onOpen={(path) => navigate(path)}
                />
              ))}

              {isEmpty && <WelcomeBoard onPick={handleQuickAsk} disabled={loading} />}
              {loading && <TypingRow />}
              <div ref={bottomRef} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white px-3 py-3 sm:px-5">
            <div className="mx-auto max-w-5xl">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => sendMessage(prompt)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-teal-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100">
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  maxLength={MAX_MESSAGE_LENGTH}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Hỏi về hệ thống, sự cố, báo cáo hoặc thất thoát DMA…"
                  className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm font-semibold leading-6 outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Gửi (Enter)"
                >
                  <FaPaperPlane className="text-sm" />
                </button>
              </div>

              <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] font-bold text-slate-400">
                <span>Enter để gửi · Shift + Enter để xuống dòng</span>
                <span>{input.length}/{MAX_MESSAGE_LENGTH}</span>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Chatbot;
