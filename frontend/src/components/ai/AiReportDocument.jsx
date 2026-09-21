import { useMemo } from "react";
import AiMarkdown from "./AiMarkdown";

const META_LABELS = [
  "Điểm đo",
  "Logger ID",
  "Khu vực/Tuyến ống",
  "Thời gian phân tích",
  "Tổng sản lượng trong kỳ",
  "DMA",
  "Kỳ phân tích",
];

const SECTION_TONES = [
  { badge: "bg-teal-600", border: "border-teal-100", header: "text-teal-800", bg: "bg-teal-50/60" },
  { badge: "bg-sky-600", border: "border-sky-100", header: "text-sky-800", bg: "bg-sky-50/60" },
  { badge: "bg-blue-600", border: "border-blue-100", header: "text-blue-800", bg: "bg-blue-50/60" },
  { badge: "bg-amber-500", border: "border-amber-100", header: "text-amber-800", bg: "bg-amber-50/60" },
  { badge: "bg-indigo-600", border: "border-indigo-100", header: "text-indigo-800", bg: "bg-indigo-50/60" },
  { badge: "bg-rose-600", border: "border-rose-100", header: "text-rose-800", bg: "bg-rose-50/60" },
  { badge: "bg-slate-700", border: "border-slate-200", header: "text-slate-800", bg: "bg-slate-50" },
  { badge: "bg-emerald-600", border: "border-emerald-100", header: "text-emerald-800", bg: "bg-emerald-50/60" },
  { badge: "bg-cyan-600", border: "border-cyan-100", header: "text-cyan-800", bg: "bg-cyan-50/60" },
];

const stripCodeFence = (content) => String(content || "")
  .trim()
  .replace(/^```(?:markdown|md)?\s*/i, "")
  .replace(/\s*```\s*$/i, "")
  .trim();

const stripInlineMarks = (value) => String(value || "")
  .replace(/\*\*/g, "")
  .replace(/`/g, "")
  .trim();

// Tach markdown thanh: tieu de, cac dong meta o dau, phan mo dau va cac muc "## n.".
// Than cua tung muc van la markdown nguyen ban, de AiMarkdown render.
const parseAiDocument = (content) => {
  const text = stripCodeFence(content);
  const lines = text.split(/\r?\n/);

  let title = "";
  const meta = [];
  const introLines = [];
  const sections = [];
  let current = null;

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!title && line.startsWith("# ")) {
      title = stripInlineMarks(line.replace(/^#\s+/, ""));
      return;
    }

    if (line.startsWith("## ")) {
      current = { heading: stripInlineMarks(line.replace(/^##\s+/, "")), lines: [] };
      sections.push(current);
      return;
    }

    if (!current) {
      const metaMatch = line.match(/^\*\*([^:*]+):\*\*\s*(.*)$/);
      if (metaMatch && META_LABELS.includes(metaMatch[1].trim())) {
        meta.push({ label: metaMatch[1].trim(), value: stripInlineMarks(metaMatch[2]) || "—" });
        return;
      }
      if (line === "---") return;
      introLines.push(rawLine);
      return;
    }

    current.lines.push(rawLine);
  });

  return {
    title,
    meta,
    intro: introLines.join("\n").trim(),
    sections: sections.map((section) => ({ ...section, body: section.lines.join("\n").trim() })),
  };
};

const splitHeading = (heading, index) => {
  const match = String(heading || "").match(/^(\d+)[.)]\s*(.*)$/);
  return {
    number: match?.[1] || String(index + 1),
    title: match?.[2] || heading,
  };
};

const AiReportDocument = ({
  content,
  badge = "Báo cáo phân tích AI",
  fallbackTitle = "Báo cáo phân tích AI",
  highlightLabel,
  streaming = false,
}) => {
  const document = useMemo(() => parseAiDocument(content), [content]);
  if (!content) return null;

  const { title, meta, intro, sections } = document;
  const highlight = highlightLabel ? meta.find((item) => item.label === highlightLabel) : null;
  const headerMeta = meta.filter((item) => item !== highlight).slice(0, 4);

  return (
    <article className="mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-slate-50 text-[15px] leading-7 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
      <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-teal-950 to-cyan-900 px-5 py-7 text-white sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-teal-300/20 blur-3xl" />

        <div className="relative">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
              {badge}
            </span>
            {streaming && (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                AI đang viết…
              </span>
            )}
          </div>

          <h1 className="max-w-4xl text-2xl font-black uppercase leading-snug sm:text-3xl">
            {title || fallbackTitle}
          </h1>

          {headerMeta.length > 0 && (
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {headerMeta.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/80">{item.label}</div>
                  <div className="mt-2 break-words text-base font-black text-white">{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {highlight && (
            <div className="mt-4 inline-flex max-w-full flex-wrap items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/15 px-4 py-3 text-amber-50">
              <span className="text-xs font-black uppercase tracking-[0.18em]">{highlight.label}</span>
              <span className="text-xl font-black">{highlight.value}</span>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-4 p-4 sm:p-6">
        {intro && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <AiMarkdown content={intro} />
          </section>
        )}

        {sections.map((section, index) => {
          const tone = SECTION_TONES[index % SECTION_TONES.length];
          const parts = splitHeading(section.heading, index);

          return (
            <section
              key={`${section.heading}-${index}`}
              className={`overflow-hidden rounded-3xl border ${tone.border} bg-white shadow-sm`}
            >
              <div className={`flex flex-col gap-3 border-b ${tone.border} ${tone.bg} px-5 py-4 sm:flex-row sm:items-center`}>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.badge} text-base font-black text-white shadow-sm`}>
                  {parts.number}
                </span>
                <h2 className={`text-xl font-black ${tone.header}`}>{parts.title}</h2>
              </div>
              <div className="px-5 py-5">
                <AiMarkdown content={section.body} />
              </div>
            </section>
          );
        })}

        {!intro && sections.length === 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <AiMarkdown content={stripCodeFence(content)} />
          </section>
        )}
      </div>
    </article>
  );
};

export default AiReportDocument;
