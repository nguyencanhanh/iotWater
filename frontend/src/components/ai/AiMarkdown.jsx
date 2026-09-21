import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

// Bang anh xa element -> class Tailwind, giu dung ngon ngu thiet ke cua trang bao cao.
// Dung react-markdown thay cho bo parse tu viet truoc day vi no hieu day du
// nghieng, code, link, gach ngang, danh sach long nhau va bang GFM khong can
// dau | o cuoi dong.
const components = {
  h1: ({ children }) => (
    <h2 className="mt-6 text-xl font-black uppercase leading-snug text-slate-900 first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-6 text-lg font-black text-slate-900 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-5 inline-flex rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-800">
      {children}
    </h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-4 text-sm font-black uppercase tracking-wide text-slate-600">{children}</h5>
  ),

  p: ({ children }) => <p className="my-2 text-sm leading-7 text-slate-700">{children}</p>,

  strong: ({ children }) => <strong className="font-bold text-slate-950">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-800">{children}</em>,
  del: ({ children }) => <del className="text-slate-400 line-through">{children}</del>,

  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-900"
    >
      {children}
    </a>
  ),

  ul: ({ children }) => <ul className="ai-md-ul my-3 grid gap-2">{children}</ul>,
  ol: ({ children }) => <ol className="ai-md-ol my-3 grid gap-2">{children}</ol>,

  // Dau dong (cham tron hay so thu tu) do CSS quyet dinh dua vao the cha,
  // vi react-markdown v9 khong con truyen prop `ordered` xuong li.
  li: ({ children }) => (
    <li className="ai-md-li flex gap-2.5 rounded-2xl border border-slate-100 bg-white px-3 py-2 text-sm leading-7 text-slate-700 shadow-sm">
      <span className="ai-md-marker" aria-hidden="true" />
      <div className="min-w-0 flex-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:mt-2 [&>ol]:mt-2">
        {children}
      </div>
    </li>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-2xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium leading-7 text-amber-900 [&>p]:my-0 [&>p]:text-amber-900">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-5 border-slate-200" />,

  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-900 text-white">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-slate-100 last:border-b-0">{children}</tr>,
  th: ({ children }) => (
    <th className="border-r border-slate-700 px-3 py-2 text-left font-bold last:border-r-0">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-r border-slate-100 px-3 py-2 align-top text-slate-700 last:border-r-0">{children}</td>
  ),

  code: ({ inline, children }) => (inline === false ? (
    <code className="block overflow-x-auto rounded-xl bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">
      {children}
    </code>
  ) : (
    <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800">
      {children}
    </code>
  )),
  pre: ({ children }) => <pre className="my-3">{children}</pre>,

  img: () => null,
};

const AiMarkdown = ({ content, className = "" }) => {
  if (!content) return null;

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default AiMarkdown;
