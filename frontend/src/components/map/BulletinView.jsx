import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { FaCopy } from "react-icons/fa";

// Noi dung nguoi dung tick chon dua vao ban tin; nho theo trinh duyet.
const OPTIONS = [
  { key: "visits", label: "Số lượt / tuyến đã nghe" },
  { key: "points", label: "Số điểm rò rỉ phát hiện" },
  { key: "customers", label: "Tổng số khách hàng" },
  { key: "lines", label: "Chi tiết từng lượt nghe" },
  { key: "notes", label: "Ghi chú của lượt nghe" },
  { key: "causes", label: "Nguyên nhân rò rỉ (%)" },
  { key: "flow", label: "Lưu lượng rò rỉ ước tính" },
];
const OPTIONS_KEY = "iot.incidentBulletinOptions";

const loadOptions = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || "null");
    if (saved && typeof saved === "object") return { ...Object.fromEntries(OPTIONS.map((item) => [item.key, true])), ...saved };
  } catch {
    // Du lieu hong thi dung mac dinh.
  }
  return Object.fromEntries(OPTIONS.map((item) => [item.key, true]));
};

const num = (value, digits = 0) => Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const plain = (value) => Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

// "1 điểm 100 - 150 l/h, 2 điểm 50 - 100 l/h"
const describePoints = (groups) => groups.map((group) => `${group.count} điểm khoảng ${group.label}`).join(", ");

export const buildBulletinText = (data, options, periodText) => {
  if (!data) return "";
  const out = [`BẢN TIN SỰ CỐ RÒ RỈ ${periodText}`.trim()];

  data.areas.forEach((area) => {
    const head = [area.areaName];
    if (options.visits) head.push(`${area.visits} lượt / ${area.routes} tuyến`);
    const tail = [];
    if (options.points) tail.push(`Tổng điểm rò: ${area.points} điểm`);
    if (options.customers) tail.push(`Tổng ${num(area.customers)} khách hàng`);
    out.push("", `${head.join(" – ")}${tail.length ? `. ${tail.join(". ")}` : ""}`);

    if (options.lines) {
      area.lines.forEach((line, index) => {
        const method = line.methods.length ? `${line.methods.join(", ")} ` : "";
        let text = `${index + 1}. ${method}${line.routeName} ${num(line.customers)} khách hàng`;
        text += line.notFound ? ", không tìm thấy điểm" : `, tìm được ${line.pointCount} điểm (${describePoints(line.pointGroups)})`;
        if (line.types.length) text += ` – ${line.types.join(", ")}`;
        text += ` [${line.dayLabel}]`;
        if (options.notes && line.notes.length) text += `. ${line.notes.join(". ")}`;
        out.push(text);
      });
      area.loosePoints.forEach((point) => {
        out.push(`- ${point.title} (khoảng ${point.leakLabel}${point.typeName ? `, ${point.typeName}` : ""}) [${point.dayLabel}]`
          + (options.notes && point.note ? `. ${point.note}` : ""));
      });
    }
  });

  if (options.causes && data.totals.points) {
    out.push("", `Nguyên nhân rò rỉ của ${data.totals.points} điểm`);
    data.causes.forEach((cause) => {
      out.push(`- ${cause.name}: ${cause.count} điểm (${num(cause.percent, 2)}%)`);
    });
  }

  if (options.flow) {
    const { flow } = data;
    const change = flow.changeM3d;
    out.push(
      "",
      `Lưu lượng rò rỉ ước tính của ${flow.points} điểm: ${plain(flow.m3d)} m³/ngày (${plain(flow.m3h)} m³/h).`
      + ` Đã xử lý triệt tiêu khoảng ${plain(flow.resolvedM3d)} m³/ngày.`,
      `So với ${flow.previous.label}: ${plain(flow.previous.m3d)} m³/ngày (${flow.previous.points} điểm)`
      + ` → ${change > 0 ? "tăng" : change < 0 ? "giảm" : "không đổi"} ${plain(Math.abs(change))} m³/ngày.`
    );
  }
  return out.join("\n");
};

const BulletinView = ({ data, periodText }) => {
  const [options, setOptions] = useState(loadOptions);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => buildBulletinText(data, options, periodText), [data, options, periodText]);

  const toggle = (key) => setOptions((prev) => {
    const next = { ...prev, [key]: !prev[key] };
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
    } catch {
      // Khong luu duoc thi chi ap dung trong lan nay.
    }
    return next;
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!data) return <div className="py-10 text-center font-semibold text-slate-400">Bấm &quot;Tra cứu&quot; để tạo bản tin</div>;

  const { totals, flow } = data;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] font-black uppercase text-slate-500">Lượt / tuyến đã nghe</div>
          <div className="mt-1 text-xl font-black text-slate-900">{totals.visits} lượt / {totals.routes} tuyến</div>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
          <div className="text-[11px] font-black uppercase text-rose-600">Điểm rò rỉ phát hiện</div>
          <div className="mt-1 text-xl font-black text-rose-700">{totals.points} điểm</div>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
          <div className="text-[11px] font-black uppercase text-sky-700">Tổng khách hàng đã nghe</div>
          <div className="mt-1 text-xl font-black text-sky-800">{num(totals.customers)}</div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
          <div className="text-[11px] font-black uppercase text-amber-700">Lưu lượng rò ước tính</div>
          <div className="mt-1 text-xl font-black text-amber-800">{plain(flow.m3d)} <span className="text-sm">m³/ngày</span></div>
          <div className="text-[11px] font-semibold text-amber-700">
            {plain(flow.m3h)} m³/h · {flow.previous.label}: {plain(flow.previous.m3d)} m³/ngày
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-1.5 text-[10px] font-black uppercase text-slate-500">Nội dung đưa vào bản tin</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {OPTIONS.map((item) => (
            <label key={item.key} className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-700">
              <input type="checkbox" checked={Boolean(options[item.key])} onChange={() => toggle(item.key)} className="h-4 w-4 accent-teal-600" />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <div className="relative rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={copy}
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
        >
          <FaCopy /> {copied ? "Đã sao chép" : "Sao chép"}
        </button>
        <pre className="whitespace-pre-wrap break-words p-4 pr-28 font-sans text-sm leading-6 text-slate-800">{text}</pre>
      </div>
      <div className="text-xs font-semibold text-slate-500">
        Lượt = mỗi tuyến được nghe trong một ngày (gồm cả lượt không tìm thấy điểm). Tổng khách hàng: mỗi tuyến
        chỉ tính 1 lần trong kỳ (số của buổi nghe gần nhất), dù nghe lại nhiều buổi.
        Lưu lượng là số ước tính từ bậc &quot;Mức độ&quot; của từng điểm, không phải số đo.
      </div>
    </div>
  );
};

BulletinView.propTypes = { data: PropTypes.object, periodText: PropTypes.string };

export default BulletinView;
