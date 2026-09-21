import { Suspense, lazy, useState } from "react";
import {
  FaBolt,
  FaChartArea,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaTable,
  FaWater,
} from "react-icons/fa";
import { Chip, CopyButton, CsvButton, DataTable, EmptyNote, ResultCard, StatTile } from "./ui";
import { formatDateTime, formatInt, formatNumber, formatUnit } from "./format";

const SeriesChart = lazy(() => import("./SeriesChart"));

const ChartFrame = ({ children }) => (
  <Suspense fallback={<div className="flex h-[260px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-400">Đang dựng biểu đồ…</div>}>
    {children}
  </Suspense>
);

const ViewTabs = ({ value, onChange, options }) => (
  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition ${
          value === option.value ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        {option.icon}
        {option.label}
      </button>
    ))}
  </div>
);

/* ------------------------------- Bao cao 1 logger ------------------------------- */

const METRIC_TABS = [
  { value: "both", label: "Áp suất + Lưu lượng", metrics: ["pressure", "flow"] },
  { value: "pressure", label: "Áp suất", metrics: ["pressure"] },
  { value: "flow", label: "Lưu lượng", metrics: ["flow"] },
  { value: "meter", label: "Đồng hồ", metrics: ["meter"] },
];

const reportCsv = (reportData) => {
  const series = reportData.series || [];
  const headers = ["Thời gian", ...series.flatMap((item) => [
    `${item.name} - Áp suất (m)`,
    `${item.name} - Lưu lượng (m³/h)`,
    `${item.name} - Đồng hồ (m³)`,
  ])];
  const rows = (reportData.labels || []).map((label, index) => [
    formatDateTime(label),
    ...series.flatMap((item) => [
      item.pressureValues?.[index] ?? "",
      item.flowValues?.[index] ?? "",
      item.meterValues?.[index] ?? "",
    ]),
  ]);
  return { headers, rows };
};

const LoggerReportPayload = ({ payload }) => {
  const [view, setView] = useState("chart");
  const [metricTab, setMetricTab] = useState("both");
  const reportData = payload?.reportData;
  const series = reportData?.series?.[0];
  if (!series) return null;

  const metrics = METRIC_TABS.find((tab) => tab.value === metricTab)?.metrics || ["pressure", "flow"];
  const csv = reportCsv(reportData);

  return (
    <ResultCard
      eyebrow="Báo cáo dữ liệu"
      title={series.name}
      subtitle={`ID ${series.id} · Nhóm ${series.group || "Không có"} · ${formatDateTime(reportData.fromDate)} → ${formatDateTime(reportData.toDate)} · mỗi ${formatInt(reportData.intervalMinutes)} phút`}
      actions={<CsvButton fileName={`bao-cao-${series.id}`} headers={csv.headers} rows={csv.rows} />}
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Sản lượng" value={formatUnit(series.flowStats?.volume, "m³")} tone="amber" />
        <StatTile label="Áp suất TB" value={formatUnit(series.pressureStats?.avg, "m")} hint={`Min ${formatNumber(series.pressureStats?.min)} · Max ${formatNumber(series.pressureStats?.max)}`} tone="teal" />
        <StatTile label="Lưu lượng TB" value={formatUnit(series.flowStats?.avg, "m³/h")} hint={`Max ${formatNumber(series.flowStats?.max)}`} tone="blue" />
        <StatTile label="Số bản ghi" value={formatInt(series.flowStats?.count)} tone="slate" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewTabs
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Biểu đồ", icon: <FaChartArea /> },
            { value: "table", label: "Bảng", icon: <FaTable /> },
          ]}
        />
        {view === "chart" && (
          <div className="flex flex-wrap gap-1">
            {METRIC_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setMetricTab(tab.value)}
                className={`rounded-md border px-2 py-1 text-[11px] font-bold transition ${
                  metricTab === tab.value
                    ? "border-teal-300 bg-teal-50 text-teal-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-teal-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "chart" ? (
        <ChartFrame><SeriesChart reportData={reportData} metrics={metrics} /></ChartFrame>
      ) : (
        <DataTable
          columns={[
            { key: "time", label: "Thời gian", strong: true },
            { key: "pressure", label: "Áp suất (m)", align: "right", render: (row) => formatNumber(row.pressure) },
            { key: "flow", label: "Lưu lượng (m³/h)", align: "right", render: (row) => formatNumber(row.flow) },
            { key: "meter", label: "Đồng hồ (m³)", align: "right", render: (row) => formatNumber(row.meter) },
          ]}
          rows={(series.samples || []).map((row, index) => ({ ...row, key: `${row.time}-${index}` }))}
        />
      )}
    </ResultCard>
  );
};

/* ------------------------------- So sanh logger ------------------------------- */

const LoggerComparePayload = ({ payload }) => {
  const [view, setView] = useState("chart");
  const [metricTab, setMetricTab] = useState("pressure");
  const reportData = payload?.reportData;
  if (!reportData?.series?.length) return null;

  const rows = payload.rows || [];
  const csv = reportCsv(reportData);
  const best = [...rows].sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0))[0];

  return (
    <ResultCard
      eyebrow="So sánh logger"
      title={`${rows.length} logger · ${payload.summary?.fromDate} → ${payload.summary?.toDate}`}
      subtitle={`Tổng sản lượng ${formatUnit(payload.summary?.totalVolume, "m³")}${best ? ` · Cao nhất: ${best.name}` : ""}`}
      actions={<CsvButton fileName="so-sanh-logger" headers={csv.headers} rows={csv.rows} />}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewTabs
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Biểu đồ", icon: <FaChartArea /> },
            { value: "table", label: "Bảng", icon: <FaTable /> },
          ]}
        />
        {view === "chart" && (
          <div className="flex flex-wrap gap-1">
            {[
              { value: "pressure", label: "Áp suất" },
              { value: "flow", label: "Lưu lượng" },
              { value: "meter", label: "Đồng hồ" },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setMetricTab(tab.value)}
                className={`rounded-md border px-2 py-1 text-[11px] font-bold transition ${
                  metricTab === tab.value
                    ? "border-teal-300 bg-teal-50 text-teal-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-teal-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "chart" ? (
        <ChartFrame><SeriesChart reportData={reportData} metrics={[metricTab]} height={280} /></ChartFrame>
      ) : null}

      <DataTable
        columns={[
          { key: "name", label: "Logger", strong: true, render: (row) => `${row.name} (${row.id})` },
          { key: "group", label: "Nhóm" },
          { key: "pressureAvg", label: "Áp TB (m)", align: "right", render: (row) => formatNumber(row.pressureAvg) },
          { key: "pressureMin", label: "Áp min", align: "right", render: (row) => formatNumber(row.pressureMin) },
          { key: "pressureMax", label: "Áp max", align: "right", render: (row) => formatNumber(row.pressureMax) },
          { key: "flowAvg", label: "Lưu lượng TB", align: "right", render: (row) => formatNumber(row.flowAvg) },
          { key: "volume", label: "Sản lượng (m³)", align: "right", render: (row) => formatNumber(row.volume) },
        ]}
        rows={rows.map((row) => ({ ...row, key: row.id }))}
      />
    </ResultCard>
  );
};

/* ------------------------------- Thong tin 1 logger ------------------------------- */

const OpenLoggerPayload = ({ payload, onOpen }) => {
  const { sensor, latest } = payload || {};
  if (!sensor) return null;

  return (
    <ResultCard
      eyebrow="Thông tin logger"
      title={sensor.name}
      subtitle={`ID ${sensor.id} · Nhóm ${sensor.group || "Không có"} · Cập nhật ${latest?.createAtText || "chưa có dữ liệu"}`}
      actions={(
        <button
          type="button"
          onClick={() => onOpen(payload.openPath)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
        >
          <FaExternalLinkAlt /> Mở trang dữ liệu
        </button>
      )}
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Trạng thái"
          value={latest?.connected ? "Đang kết nối" : "Mất tín hiệu"}
          tone={latest?.connected ? "emerald" : "rose"}
        />
        <StatTile label="Áp suất" value={formatUnit(latest?.pressure, "m")} tone="teal" />
        <StatTile label="Lưu lượng" value={formatUnit(latest?.flow, "m³/h")} tone="blue" />
        <StatTile label="Tích lũy" value={formatUnit(latest?.sum, "m³")} tone="slate" />
      </div>
      {Number.isFinite(Number(latest?.battery)) && (
        <div className="text-xs font-semibold text-slate-500">Pin: {formatNumber(latest.battery)} V</div>
      )}
    </ResultCard>
  );
};

/* ------------------------------- Danh sach logger ------------------------------- */

const LoggerListPayload = ({ payload, onQuickAsk }) => {
  const sensors = payload?.sensors || [];
  if (!sensors.length) return null;

  return (
    <ResultCard
      eyebrow="Danh sách logger"
      title={`${sensors.length}/${payload.total || sensors.length} logger phù hợp`}
      subtitle="Bấm vào một logger để xem dữ liệu mới nhất"
      actions={(
        <CsvButton
          fileName="danh-sach-logger"
          headers={["ID", "Tên logger", "Nhóm"]}
          rows={sensors.map((sensor) => [sensor.id, sensor.name, sensor.group])}
        />
      )}
    >
      <div className="grid gap-1.5 sm:grid-cols-2">
        {sensors.map((sensor) => (
          <button
            type="button"
            key={sensor.id}
            onClick={() => onQuickAsk(`Mở dữ liệu logger ${sensor.id}`)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-teal-300 hover:bg-teal-50"
          >
            <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-black text-white">{sensor.id}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-slate-900">{sensor.name}</span>
              <span className="block truncate text-[11px] font-semibold text-slate-500">{sensor.group}</span>
            </span>
          </button>
        ))}
      </div>
    </ResultCard>
  );
};

/* ------------------------------- Tong quan he thong ------------------------------- */

const SystemOverviewPayload = ({ payload, onQuickAsk }) => {
  const stats = payload?.stats;
  if (!stats) return <ResultCard eyebrow="Tổng quan" title="Chưa có logger"><EmptyNote>Không tìm thấy logger nào trong phạm vi này.</EmptyNote></ResultCard>;

  const offline = payload.offline || [];

  return (
    <ResultCard
      eyebrow="Tổng quan hệ thống"
      title={payload.group ? `Khu vực ${payload.group}` : "Toàn hệ thống"}
      subtitle={`Cập nhật ${stats.generatedAtText}`}
      actions={(
        <CsvButton
          fileName="tong-quan-he-thong"
          headers={["Nhóm", "Tổng logger", "Mất tín hiệu", "Sản lượng hôm nay (m³)"]}
          rows={(payload.groups || []).map((row) => [row.group, row.total, row.offline, row.todayVolume])}
        />
      )}
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Logger online" value={`${formatInt(stats.online)}/${formatInt(stats.total)}`} tone="emerald" />
        <StatTile label="Mất tín hiệu" value={formatInt(stats.offline)} tone={stats.offline ? "rose" : "slate"} />
        <StatTile label="Sản lượng hôm nay" value={formatUnit(stats.todayVolume, "m³")} tone="blue" />
        <StatTile label="Sự cố chưa xong" value={formatInt(stats.openIncidents)} tone={stats.openIncidents ? "amber" : "slate"} />
        <StatTile label="Cảnh báo hôm nay" value={formatInt(stats.todayAlarms)} tone={stats.todayAlarms ? "amber" : "slate"} />
      </div>

      {offline.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-rose-600">
            <FaExclamationTriangle /> Logger mất tín hiệu
          </div>
          <DataTable
            columns={[
              { key: "name", label: "Logger", strong: true, render: (row) => `${row.name} (${row.id})` },
              { key: "group", label: "Nhóm" },
              { key: "lastAtText", label: "Dữ liệu cuối" },
            ]}
            rows={offline.map((row) => ({ ...row, key: row.id }))}
            maxHeight="14rem"
          />
        </div>
      )}

      <DataTable
        columns={[
          { key: "group", label: "Nhóm", strong: true },
          { key: "total", label: "Logger", align: "right" },
          { key: "offline", label: "Mất tín hiệu", align: "right" },
          { key: "todayVolume", label: "Sản lượng hôm nay (m³)", align: "right", render: (row) => formatNumber(row.todayVolume) },
        ]}
        rows={(payload.groups || []).map((row) => ({ ...row, key: row.group }))}
        maxHeight="14rem"
      />

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onQuickAsk("Có sự cố nào chưa xử lý không?")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700">
          Xem sự cố chưa xử lý
        </button>
        <button type="button" onClick={() => onQuickAsk("Cảnh báo hôm nay")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700">
          Xem cảnh báo hôm nay
        </button>
      </div>
    </ResultCard>
  );
};

/* ------------------------------- Su co hien truong ------------------------------- */

const SEVERITY_TONE = { high: "rose", medium: "amber", low: "slate" };
const STATUS_TONE = { open: "rose", in_progress: "amber", resolved: "emerald" };

const IncidentListPayload = ({ payload, onOpen }) => {
  const incidents = payload?.incidents || [];
  const stats = payload?.stats || {};

  return (
    <ResultCard
      eyebrow="Sự cố hiện trường"
      title={payload?.scope?.label || "Sự cố"}
      subtitle={`Toàn hệ thống: ${formatInt(stats.open)} chưa xử lý · ${formatInt(stats.inProgress)} đang xử lý · ${formatInt(stats.resolved)} đã xong`}
      actions={(
        <>
          {incidents.length > 0 && (
            <CsvButton
              fileName="su-co-hien-truong"
              headers={["Tiêu đề", "Loại", "Mức độ", "Trạng thái", "Khu vực", "Địa chỉ", "Phát hiện", "Xử lý xong"]}
              rows={incidents.map((item) => [
                item.title, item.typeLabel, item.severityLabel, item.statusLabel,
                item.group, item.address, item.occurredAtText, item.resolvedAtText,
              ])}
            />
          )}
          <button
            type="button"
            onClick={() => onOpen("/admin-dashboard")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
          >
            <FaMapMarkerAlt /> Xem bản đồ
          </button>
        </>
      )}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <StatTile label="Chưa xử lý" value={formatInt(stats.open)} tone="rose" />
        <StatTile label="Đang xử lý" value={formatInt(stats.inProgress)} tone="amber" />
        <StatTile label="Đã xử lý" value={formatInt(stats.resolved)} tone="emerald" />
      </div>

      {incidents.length === 0 ? (
        <EmptyNote>Không có sự cố nào khớp điều kiện.</EmptyNote>
      ) : (
        <div className="space-y-1.5">
          {incidents.map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone={SEVERITY_TONE[item.severity] || "slate"}>{item.typeLabel}</Chip>
                <Chip tone={STATUS_TONE[item.status] || "slate"}>{item.statusLabel}</Chip>
                <Chip tone="slate">{item.severityLabel}</Chip>
                {Number.isFinite(Number(item.distanceMeters)) && (
                  <Chip tone="blue">cách {formatInt(item.distanceMeters)} m</Chip>
                )}
              </div>
              <div className="mt-1.5 text-sm font-black text-slate-900">{item.title}</div>
              {(item.address || item.group) && (
                <div className="text-xs font-semibold text-slate-500">
                  {[item.address, item.group && `Khu vực: ${item.group}`].filter(Boolean).join(" · ")}
                </div>
              )}
              <div className="mt-0.5 text-xs text-slate-500">
                Phát hiện: {item.occurredAtText}
                {item.resolvedAtText ? ` · Xử lý xong: ${item.resolvedAtText}` : ""}
                {item.nearestLoggerName ? ` · Gần ${item.nearestLoggerName}` : ""}
              </div>
              {item.note && <p className="mt-1.5 whitespace-pre-line text-xs leading-5 text-slate-600">{item.note}</p>}
            </div>
          ))}
        </div>
      )}
    </ResultCard>
  );
};

/* ------------------------------- Canh bao ------------------------------- */

const LEVEL_TONE = { danger: "rose", critical: "rose", warning: "amber", info: "blue" };

const AlertListPayload = ({ payload }) => {
  const alerts = payload?.alerts || [];

  return (
    <ResultCard
      eyebrow="Cảnh báo hệ thống"
      title={`${formatInt(payload?.total)} cảnh báo`}
      subtitle={`${payload?.range?.fromText} → ${payload?.range?.toText}${payload?.group ? ` · Khu vực ${payload.group}` : ""}${payload?.truncated ? ` · hiển thị ${formatInt(payload.shown)} bản ghi mới nhất` : ""}`}
      actions={alerts.length > 0 && (
        <CsvButton
          fileName="canh-bao"
          headers={["Thời gian", "Nội dung", "Logger", "Nhóm", "Mức", "Giá trị"]}
          rows={alerts.map((item) => [item.createAtText, item.message, item.sensorName || item.sensorId, item.group, item.level, item.value])}
        />
      )}
    >
      {payload?.topSensors?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {payload.topSensors.map((item) => (
            <Chip key={item.name} tone="amber"><FaBolt /> {item.name}: {item.count}</Chip>
          ))}
        </div>
      )}

      <DataTable
        columns={[
          { key: "createAtText", label: "Thời gian", strong: true },
          { key: "message", label: "Nội dung" },
          { key: "sensorName", label: "Logger", render: (row) => row.sensorName || row.sensorId || "—" },
          { key: "group", label: "Nhóm" },
          {
            key: "level",
            label: "Mức",
            render: (row) => <Chip tone={LEVEL_TONE[row.level] || "slate"}>{row.level}</Chip>,
          },
        ]}
        rows={alerts.map((row, index) => ({ ...row, key: `${row.createAtText}-${index}` }))}
        emptyText="Không có cảnh báo nào trong khoảng này."
        maxHeight="22rem"
      />
    </ResultCard>
  );
};

/* ------------------------------- That thoat DMA ------------------------------- */

const lossTone = (rate) => {
  const value = Number(rate);
  if (!Number.isFinite(value)) return "slate";
  if (value >= 25) return "rose";
  if (value >= 15) return "amber";
  return "emerald";
};

const DmaLossPayload = ({ payload, onOpen }) => {
  const summary = payload?.summary || {};
  const loggerRows = [
    ...(payload.inlets || []).map((item) => ({ ...item, role: "Đầu vào" })),
    ...(payload.consumes || []).map((item) => ({ ...item, role: "Tiêu thụ" })),
  ];

  return (
    <ResultCard
      eyebrow="Thất thoát DMA"
      title={payload?.dma?.name}
      subtitle={`${payload?.range?.fromText} → ${payload?.range?.toText}${payload?.dma?.group ? ` · Khu vực ${payload.dma.group}` : ""}`}
      actions={(
        <>
          <CsvButton
            fileName={`dma-${payload?.dma?.name || "that-thoat"}`}
            headers={["Vai trò", "Logger", "Sản lượng (m³)", "Lưu lượng min", "Lưu lượng TB"]}
            rows={loggerRows.map((item) => [item.role, `${item.name} (${item.id})`, item.volume, item.minFlow, item.avgFlow])}
          />
          <button
            type="button"
            onClick={() => onOpen(payload.openPath)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
          >
            <FaExternalLinkAlt /> Trang DMA
          </button>
        </>
      )}
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Đầu vào" value={formatUnit(summary.inletTotal, "m³")} tone="blue" />
        <StatTile label="Ghi nhận" value={formatUnit(summary.accountedTotal, "m³")} hint={`Tiêu thụ ${formatNumber(summary.consumeTotal)} + DMA con ${formatNumber(summary.childInletTotal)}`} tone="teal" />
        <StatTile label="Thất thoát" value={formatUnit(summary.loss, "m³")} tone={lossTone(summary.lossRate)} />
        <StatTile label="Tỷ lệ thất thoát" value={`${formatNumber(summary.lossRate)} %`} tone={lossTone(summary.lossRate)} />
        <StatTile label="Lưu lượng đêm (MNF)" value={formatUnit(summary.mnf, "m³/h")} tone="slate" />
      </div>

      <DataTable
        columns={[
          { key: "role", label: "Vai trò", strong: true },
          { key: "name", label: "Logger", render: (row) => `${row.name} (${row.id})` },
          { key: "volume", label: "Sản lượng (m³)", align: "right", render: (row) => formatNumber(row.volume) },
          { key: "minFlow", label: "Lưu lượng min", align: "right", render: (row) => formatNumber(row.minFlow) },
          { key: "avgFlow", label: "Lưu lượng TB", align: "right", render: (row) => formatNumber(row.avgFlow) },
          {
            key: "hasData",
            label: "Dữ liệu",
            render: (row) => (row.hasData ? <Chip tone="emerald">Có</Chip> : <Chip tone="rose">Thiếu</Chip>),
          },
        ]}
        rows={loggerRows.map((row, index) => ({ ...row, key: `${row.role}-${row.id}-${index}` }))}
        emptyText="DMA này chưa gán logger nào."
      />

      {payload.children?.length > 0 && (
        <DataTable
          columns={[
            { key: "name", label: "DMA con", strong: true },
            { key: "inletTotal", label: "Đầu vào (m³)", align: "right", render: (row) => formatNumber(row.inletTotal) },
            { key: "loss", label: "Thất thoát (m³)", align: "right", render: (row) => formatNumber(row.loss) },
            { key: "lossRate", label: "Tỷ lệ (%)", align: "right", render: (row) => formatNumber(row.lossRate) },
          ]}
          rows={payload.children.map((row) => ({ ...row, key: row.name }))}
          maxHeight="14rem"
        />
      )}
    </ResultCard>
  );
};

const DmaCandidatesPayload = ({ payload, onQuickAsk }) => {
  const dmas = payload?.dmas || [];
  if (!dmas.length) {
    return (
      <ResultCard eyebrow="Thất thoát DMA" title="Chưa có DMA nào">
        <EmptyNote>Hệ thống chưa khai báo DMA. Vào trang Thất thoát DMA để tạo trước.</EmptyNote>
      </ResultCard>
    );
  }

  return (
    <ResultCard eyebrow="Thất thoát DMA" title="Chọn DMA cần xem" subtitle={`${payload.total} DMA đang khai báo`}>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {dmas.map((dma) => (
          <button
            type="button"
            key={dma.id}
            onClick={() => onQuickAsk(`Thất thoát DMA ${dma.name} tháng này`)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-teal-300 hover:bg-teal-50"
          >
            <FaWater className="shrink-0 text-teal-600" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-900">{dma.name}</span>
              {dma.group && <span className="block truncate text-[11px] font-semibold text-slate-500">{dma.group}</span>}
            </span>
          </button>
        ))}
      </div>
    </ResultCard>
  );
};

/* ------------------------------- Thieu khoang ngay ------------------------------- */

const NeedDateRangePayload = ({ payload, onQuickAsk }) => {
  const sensor = payload?.sensor;
  if (!sensor) return null;
  const presets = ["hôm nay", "hôm qua", "7 ngày qua", "tuần này", "tháng này"];

  return (
    <ResultCard eyebrow="Cần thêm thông tin" title={`Chọn khoảng thời gian cho ${sensor.name}`} subtitle={`ID ${sensor.id} · Nhóm ${sensor.group}`}>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset}
            onClick={() => onQuickAsk(`Xuất dữ liệu logger ${sensor.id} ${preset}`)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
          >
            {preset}
          </button>
        ))}
      </div>
    </ResultCard>
  );
};

/* ------------------------------- Bo dinh tuyen ------------------------------- */

const PayloadRenderer = ({ payload, onQuickAsk, onOpen }) => {
  if (!payload) return null;

  switch (payload.type) {
    case "logger_report":
      return <LoggerReportPayload payload={payload} />;
    case "logger_compare":
      return <LoggerComparePayload payload={payload} />;
    case "open_logger":
      return <OpenLoggerPayload payload={payload} onOpen={onOpen} />;
    case "system_overview":
      return <SystemOverviewPayload payload={payload} onQuickAsk={onQuickAsk} />;
    case "incident_list":
      return <IncidentListPayload payload={payload} onOpen={onOpen} />;
    case "alert_list":
      return <AlertListPayload payload={payload} />;
    case "dma_loss":
      return <DmaLossPayload payload={payload} onOpen={onOpen} />;
    case "dma_candidates":
      return <DmaCandidatesPayload payload={payload} onQuickAsk={onQuickAsk} />;
    case "need_date_range":
      return <NeedDateRangePayload payload={payload} onQuickAsk={onQuickAsk} />;
    case "logger_list":
    case "sensor_candidates":
      return (
        <LoggerListPayload
          payload={{
            sensors: payload.sensors || payload.candidates || [],
            total: payload.total ?? payload.candidates?.length ?? 0,
          }}
          onQuickAsk={onQuickAsk}
        />
      );
    default:
      return null;
  }
};

export { CopyButton };
export default PayloadRenderer;
