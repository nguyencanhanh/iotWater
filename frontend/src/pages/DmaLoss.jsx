import React, { useEffect, useMemo, useState } from "react";
import { FaCalculator, FaEdit, FaPlus, FaRobot, FaSave, FaSitemap, FaSyncAlt, FaTint, FaTrash, FaWater } from "react-icons/fa";
import { dmaAnalyzePost, dmaCalculatePost, dmaCreatePost, dmaDelete, dmaListGet, dmaUpdatePut, getGroupInfo } from "../api";
import { useAuth } from "../context/authContext";

const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
const emptyForm = { name: "", description: "", group: "", parentDmaId: "", inletLoggerIds: [], consumeLoggerIds: [], sensorLinks: [] };

const formatNumber = (value, digits = 1) => {
  if (!Number.isFinite(value)) return "0.0";
  return value.toLocaleString("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const MetricBox = ({ label, value, unit, tone = "teal" }) => {
  const toneClass = tone === "red" ? "border-red-500 text-red-700" : tone === "blue" ? "border-blue-500 text-blue-700" : "border-teal-500 text-teal-700";

  return (
    <div className={`rounded-lg border border-gray-200 border-t-4 ${toneClass} bg-white p-4 shadow-sm`}>
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-extrabold text-gray-900">{value}</span>
        <span className="pb-1 text-sm font-semibold text-gray-500">{unit}</span>
      </div>
    </div>
  );
};

const buildDmaTree = (dmas, parentId = "") =>
  dmas
    .filter((dma) => String(dma.parentDmaId || "") === String(parentId || ""))
    .map((dma) => ({ ...dma, children: buildDmaTree(dmas, dma._id) }));

const buildSensorTree = ({ rootIds, links, sensorById }) => {
  const linksByParent = (links || []).reduce((map, link) => {
    const parentId = Number(link.parentId);
    if (!map[parentId]) map[parentId] = [];
    map[parentId].push(Number(link.childId));
    return map;
  }, {});

  const buildNode = (id, path = []) => {
    if (path.includes(id)) return null;
    const sensor = sensorById[id] || { id, name: `Logger ${id}`, group: "" };
    return {
      ...sensor,
      children: (linksByParent[id] || [])
        .map((childId) => buildNode(childId, [...path, id]))
        .filter(Boolean),
    };
  };

  return (rootIds || []).map((id) => buildNode(Number(id))).filter(Boolean);
};

const wouldCreateSensorCycle = ({ parentId, childId, links }) => {
  const linksByParent = (links || []).reduce((map, link) => {
    const parent = Number(link.parentId);
    if (!map[parent]) map[parent] = [];
    map[parent].push(Number(link.childId));
    return map;
  }, {});
  const stack = [Number(childId)];
  const target = Number(parentId);
  const visited = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(linksByParent[current] || []));
  }

  return false;
};

const getLeafSensorIds = (rootIds, links) => {
  const childIds = new Set((links || []).map((link) => Number(link.childId)));
  const parentIds = new Set((links || []).map((link) => Number(link.parentId)));
  const leaves = [...childIds].filter((id) => !parentIds.has(id));

  if (leaves.length) return leaves;
  return (rootIds || []).map(Number).filter((id) => Number.isFinite(id));
};

const getDescendantIds = (rootId, links) => {
  const linksByParent = (links || []).reduce((map, link) => {
    const parent = Number(link.parentId);
    if (!map[parent]) map[parent] = [];
    map[parent].push(Number(link.childId));
    return map;
  }, {});
  const result = new Set();
  const stack = [Number(rootId)];

  while (stack.length) {
    const current = stack.pop();
    for (const childId of linksByParent[current] || []) {
      if (result.has(childId)) continue;
      result.add(childId);
      stack.push(childId);
    }
  }

  return result;
};

const flattenSensorResultTree = (nodes, depth = 0, parentName = "") =>
  (nodes || []).flatMap((node) => [
    { ...node, depth, parentName },
    ...flattenSensorResultTree(node.children || [], depth + 1, node.name || `Logger ${node.id}`),
  ]);

const LoggerPicker = ({ title, sensors, selectedIds, onToggle }) => (
  <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-200 px-4 py-3">
      <h4 className="font-bold text-gray-800">{title}</h4>
      <p className="mt-1 text-xs text-gray-500">{selectedIds.length} logger đang chọn</p>
    </div>
    <div className="max-h-[360px] overflow-y-auto p-3">
      <div className="space-y-2">
        {sensors.map((sensor) => {
          const checked = selectedIds.includes(sensor.id);
          return (
            <label
              key={sensor.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                checked ? "border-teal-500 bg-teal-50" : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(sensor.id)}
                className="h-5 w-5 accent-teal-600"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-gray-800">{sensor.name}</div>
                <div className="text-xs text-gray-500">ID: {sensor.id} - Nhóm: {sensor.group || "Không có"}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  </div>
);

const DmaLoss = () => {
  const { user } = useAuth();
  const currentUser = user?.user ?? 0;
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [sensors, setSensors] = useState([]);
  const [dmas, setDmas] = useState([]);
  const [selectedDmaId, setSelectedDmaId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [linkParentId, setLinkParentId] = useState("");
  const [linkChildId, setLinkChildId] = useState("");
  const [rootSensorId, setRootSensorId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiUsage, setAiUsage] = useState(null);
  const [saving, setSaving] = useState(false);

  const selectedDma = useMemo(() => dmas.find((dma) => dma._id === selectedDmaId), [dmas, selectedDmaId]);
  const dmaTree = useMemo(() => buildDmaTree(dmas), [dmas]);
  const sensorById = useMemo(
    () => Object.fromEntries(sensors.map((sensor) => [sensor.id, sensor])),
    [sensors]
  );

  const fetchSensors = async () => {
    const res = await getGroupInfo(localStorage.getItem("token"), currentUser);
    if (res.data.success) {
      const allSensors = Object.entries(res.data.data || {}).flatMap(([group, list]) =>
        list.map((sensor) => ({ ...sensor, group }))
      );
      setSensors(allSensors.sort((a, b) => String(a.group).localeCompare(String(b.group)) || a.id - b.id));
    }
  };

  const fetchDmas = async () => {
    const res = await dmaListGet(localStorage.getItem("token"), currentUser);
    if (res.data.success) {
      setDmas(res.data.dmas);
      if (!selectedDmaId && res.data.dmas[0]) setSelectedDmaId(res.data.dmas[0]._id);
    }
  };

  useEffect(() => {
    Promise.all([fetchSensors(), fetchDmas()]).catch((error) => {
      console.error(error);
      alert(error.response?.data?.error || "Không tải được dữ liệu DMA");
    });
  }, [currentUser]);

  const toggleFormId = (id, field) => {
    setForm((prev) => {
      const current = prev[field] || [];
      return {
        ...prev,
        [field]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      };
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setLinkParentId("");
    setLinkChildId("");
    setRootSensorId("");
    setIsFormOpen(true);
    setResult(null);
    setAiAnalysis("");
    setAiError("");
    setAiUsage(null);
  };

  const startEdit = (dma) => {
    setEditingId(dma._id);
    setSelectedDmaId(dma._id);
    setForm({
      name: dma.name || "",
      description: dma.description || "",
      group: dma.group || "",
      parentDmaId: dma.parentDmaId || "",
      inletLoggerIds: dma.inletLoggerIds || [],
      consumeLoggerIds: dma.consumeLoggerIds || [],
      sensorLinks: dma.sensorLinks || [],
    });
    setLinkParentId("");
    setLinkChildId("");
    setRootSensorId("");
    setIsFormOpen(true);
    setResult(null);
    setAiAnalysis("");
    setAiError("");
    setAiUsage(null);
  };

  const handleAddRootSensor = () => {
    const id = Number(rootSensorId);
    if (!id) {
      alert("Vui lòng chọn sensor gốc");
      return;
    }
    if (form.inletLoggerIds.includes(id) || form.sensorLinks.some((link) => Number(link.childId) === id)) {
      alert("Sensor này đã nằm trong cây");
      return;
    }

    setForm((prev) => ({
      ...prev,
      inletLoggerIds: [...prev.inletLoggerIds, id],
    }));
    setRootSensorId("");
  };

  const handleRemoveRootSensor = (id) => {
    const removedIds = getDescendantIds(id, form.sensorLinks);
    removedIds.add(Number(id));
    setForm((prev) => ({
      ...prev,
      inletLoggerIds: prev.inletLoggerIds.filter((item) => !removedIds.has(Number(item))),
      sensorLinks: prev.sensorLinks.filter((link) => !removedIds.has(Number(link.parentId)) && !removedIds.has(Number(link.childId))),
      consumeLoggerIds: prev.consumeLoggerIds.filter((item) => !removedIds.has(Number(item))),
    }));
  };

  const handleAddSensorLink = (parentOverride) => {
    const parentId = Number(parentOverride ?? linkParentId);
    const childId = Number(linkChildId);
    if (!parentId || !childId) {
      alert("Vui lòng chọn sensor cha và sensor con");
      return;
    }
    if (parentId === childId) {
      alert("Sensor cha và sensor con không được trùng nhau");
      return;
    }
    if (form.sensorLinks.some((link) => Number(link.parentId) === parentId && Number(link.childId) === childId)) {
      alert("Liên kết này đã tồn tại");
      return;
    }
    if (form.inletLoggerIds.includes(childId) || form.sensorLinks.some((link) => Number(link.childId) === childId)) {
      alert("Sensor con này đã nằm trong cây. Mỗi sensor chỉ nên có một cha.");
      return;
    }
    const parentIsInTree = form.inletLoggerIds.includes(parentId)
      || form.sensorLinks.some((link) => Number(link.parentId) === parentId || Number(link.childId) === parentId);
    if (!parentIsInTree) {
      alert("Sensor cha phải là sensor đầu vào/gốc hoặc sensor đã nằm trong cây");
      return;
    }
    if (wouldCreateSensorCycle({ parentId, childId, links: form.sensorLinks })) {
      alert("Liên kết này tạo vòng lặp trong cây sensor");
      return;
    }

    setForm((prev) => ({
      ...prev,
      sensorLinks: [...(prev.sensorLinks || []), { parentId, childId }],
    }));
    setLinkParentId(String(parentId));
    setLinkChildId("");
  };

  const handleRemoveSensorLink = (parentId, childId) => {
    setForm((prev) => ({
      ...prev,
      sensorLinks: (prev.sensorLinks || []).filter((link) => Number(link.parentId) !== Number(parentId) || Number(link.childId) !== Number(childId)),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("Vui lòng nhập tên DMA");
      return;
    }
    if (!form.inletLoggerIds.length) {
      alert("Vui lòng chọn ít nhất 1 logger nước cấp vào");
      return;
    }
    if (editingId && form.parentDmaId === editingId) {
      alert("DMA không thể tự chọn chính nó làm DMA cha");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        consumeLoggerIds: form.sensorLinks?.length
          ? getLeafSensorIds(form.inletLoggerIds, form.sensorLinks)
          : form.consumeLoggerIds,
        user: currentUser,
      };
      const res = editingId
        ? await dmaUpdatePut(localStorage.getItem("token"), editingId, payload)
        : await dmaCreatePost(localStorage.getItem("token"), payload);
      await fetchDmas();
      setSelectedDmaId(res.data.dma._id);
      setEditingId(null);
      setForm(emptyForm);
      setIsFormOpen(false);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Không lưu được DMA");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dma) => {
    if (!window.confirm(`Xóa DMA "${dma.name}"?`)) return;
    try {
      await dmaDelete(localStorage.getItem("token"), dma._id, currentUser);
      setSelectedDmaId("");
      setResult(null);
      setAiAnalysis("");
      setAiError("");
      await fetchDmas();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Không xóa được DMA");
    }
  };

  const handleCalculate = async () => {
    if (!selectedDmaId) {
      alert("Vui lòng chọn một DMA đã lưu");
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      alert("Ngày bắt đầu không được lớn hơn ngày kết thúc");
      return;
    }

    setLoading(true);
    try {
      const res = await dmaCalculatePost(localStorage.getItem("token"), {
        dmaId: selectedDmaId,
        fromDate,
        toDate,
        user: currentUser,
      });
      setResult(res.data.result);
      setAiAnalysis("");
      setAiError("");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Không tính được DMA");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeWithAi = async () => {
    if (!result) {
      setAiError("Hãy tính DMA trước khi phân tích AI");
      return;
    }

    setAiLoading(true);
    setAiError("");
    try {
      const res = await dmaAnalyzePost(localStorage.getItem("token"), {
        result,
        context: {
          dmaName: selectedDma?.name,
          fromDate,
          toDate,
          user: currentUser,
        },
      });
      if (res.data.success) {
        setAiAnalysis(res.data.analysis || "");
        setAiUsage(res.data.aiUsage || null);
      }
    } catch (error) {
      setAiUsage(error.response?.data?.aiUsage || null);
      setAiError(error.response?.data?.error || "Không phân tích được DMA bằng AI");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="max-w-full overflow-x-hidden p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Quản lý thất thoát DMA</h2>
        </div>
        <button
          onClick={startCreate}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          <FaPlus />
          Tạo DMA
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,430px)_minmax(0,1fr)]">
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-3">
            <h3 className="font-bold text-gray-800">Mạng DMA</h3>
            <p className="mt-1 text-xs text-gray-500">DMA con của từng vùng.</p>
          </div>
          <div className="space-y-2">
            {dmas.length === 0 ? (
              <div className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">Chưa có bộ DMA nào</div>
            ) : (
              <DmaTreeList
                nodes={dmaTree}
                sensorById={sensorById}
                selectedDmaId={selectedDmaId}
                onSelect={(dma) => { setSelectedDmaId(dma._id); setResult(null); }}
              />
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Từ ngày</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Đến ngày</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200" />
            </div>
            <button
              onClick={handleCalculate}
              disabled={loading || !selectedDmaId}
              className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 py-2 font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              <FaCalculator />
              {loading ? "Đang tính..." : "Tính DMA"}
            </button>
          </div>

          {selectedDma && (
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedDma.name}</h3>
                  <p className="mt-1 text-sm text-gray-600">{selectedDma.description || "Chưa có ghi chú"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(selectedDma)} className="flex items-center gap-2 rounded bg-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                    <FaEdit /> Sửa
                  </button>
                  <button onClick={() => handleDelete(selectedDma)} className="flex items-center gap-2 rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
                    <FaTrash /> Xóa
                  </button>
                </div>
              </div>
            </div>
          )}

          {(isFormOpen || !dmas.length) && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-gray-900">{editingId ? "Sửa bộ DMA" : "Tạo mạng DMA"}</h3>
                <button onClick={handleSave} disabled={saving} className="flex min-h-10 items-center gap-2 rounded bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:bg-gray-400">
                  <FaSave /> {saving ? "Đang lưu..." : "Lưu DMA"}
                </button>
              </div>
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Tên DMA" className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200" />
                <input value={form.group} onChange={(e) => setForm((prev) => ({ ...prev, group: e.target.value }))} placeholder="Nhóm/khu vực" className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200" />
                <input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Ghi chú" className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200" />
              </div>
              <SensorLinkEditor
                sensors={sensors}
                sensorById={sensorById}
                rootIds={form.inletLoggerIds}
                links={form.sensorLinks || []}
                parentId={linkParentId}
                childId={linkChildId}
                rootSensorId={rootSensorId}
                onRootChange={setRootSensorId}
                onAddRoot={handleAddRootSensor}
                onRemoveRoot={handleRemoveRootSensor}
                onParentChange={setLinkParentId}
                onChildChange={setLinkChildId}
                onAdd={handleAddSensorLink}
                onRemove={handleRemoveSensorLink}
              />
            </div>
          )}

          {result && (
            <>
              <div className="grid gap-3 md:grid-cols-5">
                <MetricBox label="Nước cấp vào" value={formatNumber(result.inletTotal)} unit="m3" tone="blue" />
                <MetricBox label="Tiêu thụ trực tiếp" value={formatNumber(result.consumeTotal)} unit="m3" />
                <MetricBox label="Cấp xuống DMA con" value={formatNumber(result.childInletTotal)} unit="m3" tone="blue" />
                <MetricBox label="Thất thoát" value={formatNumber(result.loss)} unit="m3" tone={result.loss > 0 ? "red" : "teal"} />
                <MetricBox label="Tỷ lệ thất thoát" value={formatNumber(result.lossRate, 2)} unit="%" tone={result.lossRate > 15 ? "red" : "teal"} />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                      <FaRobot className="text-teal-600" />
                      Phân tích AI DMA
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">AI sẽ đọc kết quả DMA hiện tại và gợi ý nhánh cần kiểm tra trước.</p>
                    {aiUsage && (
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        Còn {aiUsage.remaining}/{aiUsage.limit} lượt AI hôm nay
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleAnalyzeWithAi}
                    disabled={aiLoading || aiUsage?.remaining === 0}
                    className="flex min-h-10 items-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {aiLoading ? <FaSyncAlt className="animate-spin" /> : <FaRobot />}
                    {aiLoading ? "AI đang phân tích..." : "Phân tích AI"}
                  </button>
                </div>
                {(aiAnalysis || aiError || aiLoading) && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    {aiLoading && <div className="text-sm font-semibold text-slate-500">AI đang đọc dữ liệu thất thoát và cây sensor...</div>}
                    {aiError && <div className="text-sm font-bold text-red-600">{aiError}</div>}
                    {aiAnalysis && <div className="whitespace-pre-line text-sm leading-6 text-slate-700">{aiAnalysis}</div>}
                  </div>
                )}
              </div>
              <DmaResultTree node={result} />
              {result.sensorTree?.length > 0 ? (
                <BranchAnalysisTable rows={flattenSensorResultTree(result.sensorTree)} />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Chi tiết nước cấp vào" icon={<FaWater className="text-blue-600" />} rows={result.inlets} />
                  <ResultPanel title="Chi tiết nước tiêu thụ" icon={<FaTint className="text-teal-600" />} rows={result.consumes} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DmaTreeList = ({ nodes, sensorById, selectedDmaId, onSelect, depth = 0 }) => {
  const [openSensorTrees, setOpenSensorTrees] = useState({});

  const toggleSensorTree = (id) => {
    setOpenSensorTrees((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-3">
      {nodes.map((dma) => {
        const isOpen = Boolean(openSensorTrees[dma._id]);
        const hasSensorTree = Boolean(dma.sensorLinks?.length);

        return (
          <div key={dma._id} style={{ marginLeft: depth ? 14 : 0 }}>
            <button
              onClick={() => onSelect(dma)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                selectedDmaId === dma._id ? "border-teal-500 bg-teal-50" : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{depth ? "└─" : "●"}</span>
                <span className="font-bold text-gray-900">{dma.name}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {dma.inletLoggerIds?.length || 0} gốc
                {" - "}
                {hasSensorTree ? `${getLeafSensorIds(dma.inletLoggerIds || [], dma.sensorLinks || []).length} nhánh cuối` : `${dma.consumeLoggerIds?.length || 0} tiêu thụ`}
                {" - "}
                {dma.children?.length || 0} DMA con
              </div>
            </button>
            {hasSensorTree ? (
              <div className="ml-5 mt-2 border-l border-dashed border-gray-300 pl-3">
                <button
                  type="button"
                  onClick={() => toggleSensorTree(dma._id)}
                  className="mb-2 rounded bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  {isOpen ? "Ẩn cây sensor" : "Hiện cây sensor"}
                </button>
                {isOpen && (
                  <SensorHierarchy
                    nodes={buildSensorTree({ rootIds: dma.inletLoggerIds || [], links: dma.sensorLinks || [], sensorById })}
                  />
                )}
              </div>
            ) : (
              <>
                <SensorBranch
                  title="Sensor cấp vào / cha"
                  ids={dma.inletLoggerIds || []}
                  sensorById={sensorById}
                  tone="blue"
                />
                <SensorBranch
                  title="Sensor tiêu thụ / con"
                  ids={dma.consumeLoggerIds || []}
                  sensorById={sensorById}
                  tone="teal"
                />
              </>
            )}
            {dma.children?.length > 0 && (
              <div className="mt-3 border-l-2 border-dashed border-slate-300 pl-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">DMA con</div>
                <DmaTreeList nodes={dma.children} sensorById={sensorById} selectedDmaId={selectedDmaId} onSelect={onSelect} depth={depth + 1} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const SensorHierarchy = ({ nodes, depth = 0 }) => {
  if (!nodes.length) return <div className="text-xs text-gray-400">Chưa có cây sensor</div>;

  return (
    <div className="space-y-2">
      {nodes.map((sensor) => (
        <div key={`${sensor.id}-${depth}`} className={depth ? "border-l border-dashed border-gray-300 pl-3" : ""}>
          <div className={`rounded-lg border px-3 py-2 text-xs ${depth ? "border-teal-200 bg-teal-50 text-teal-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{depth ? "└" : "●"}</span>
              <span className="truncate font-bold">{sensor.name || `Logger ${sensor.id}`}</span>
            </div>
            <div className="ml-5 mt-1 text-[11px] opacity-80">ID: {sensor.id} - Nhóm: {sensor.group || "Không có"}</div>
          </div>
          {sensor.children?.length > 0 && (
            <div className="ml-5 mt-2">
              <SensorHierarchy nodes={sensor.children} depth={depth + 1} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const SensorLinkEditor = ({
  sensors,
  sensorById,
  rootIds,
  links,
  parentId,
  childId,
  rootSensorId,
  onRootChange,
  onAddRoot,
  onRemoveRoot,
  onParentChange,
  onChildChange,
  onAdd,
  onRemove,
}) => (
  <div className="mt-4 rounded-lg border border-gray-200 bg-slate-50 p-3 sm:p-4">
    <div className="mb-3">
      <h4 className="font-bold text-gray-900">Cấu hình mạng DMA</h4>
    </div>
    <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
      <select
        value={rootSensorId}
        onChange={(e) => onRootChange(e.target.value)}
        className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
      >
        <option value="">Chọn sensor vào mạng DMA</option>
        {sensors.map((sensor) => (
          <option key={sensor.id} value={sensor.id}>{sensor.name} - ID {sensor.id}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={onAddRoot}
        className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
      >
        Thêm gốc
      </button>
    </div>
    {rootIds.length > 0 && (
      <div className="max-w-full overflow-x-auto rounded border border-blue-100 bg-white p-3 sm:p-4">
        <SensorOrgChart
          nodes={buildSensorTree({ rootIds, links, sensorById })}
          activeParentId={parentId}
          childId={childId}
          sensors={sensors}
          onStartAdd={(id) => {
            onParentChange(String(id));
            onChildChange("");
          }}
          onChildChange={onChildChange}
          onConfirmAdd={() => onAdd(parentId)}
          onCancelAdd={() => {
            onParentChange("");
            onChildChange("");
          }}
          onRemove={onRemove}
          onRemoveRoot={onRemoveRoot}
        />
      </div>
    )}
    {!rootIds.length && (
      <div className="rounded border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-gray-500">
        Chọn ít nhất một cảm biến đầu vào.
      </div>
    )}
  </div>
);

const SensorOrgChart = ({
  nodes,
  activeParentId,
  childId,
  sensors,
  onStartAdd,
  onChildChange,
  onConfirmAdd,
  onCancelAdd,
  onRemove,
  onRemoveRoot,
}) => (
  <div className="flex w-max min-w-full justify-start gap-6 pb-2 sm:justify-center sm:gap-10">
    {nodes.map((node) => (
      <SensorOrgNode
        key={node.id}
        node={node}
        activeParentId={activeParentId}
        childId={childId}
        sensors={sensors}
        onStartAdd={onStartAdd}
        onChildChange={onChildChange}
        onConfirmAdd={onConfirmAdd}
        onCancelAdd={onCancelAdd}
        onRemove={onRemove}
        onRemoveRoot={onRemoveRoot}
      />
    ))}
  </div>
);

const SensorOrgNode = ({
  node,
  activeParentId,
  childId,
  sensors,
  onStartAdd,
  onChildChange,
  onConfirmAdd,
  onCancelAdd,
  onRemove,
  onRemoveRoot,
}) => {
  const isAdding = String(activeParentId) === String(node.id);

  return (
    <div className="flex flex-col items-center">
      <div className="relative rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-bold text-white shadow-md sm:px-4 sm:py-3 sm:text-sm">
        <div className="max-w-[140px] truncate sm:max-w-[170px]">{node.name || `Logger ${node.id}`}</div>
        <div className="mt-1 text-[11px] font-semibold opacity-80">ID: {node.id}</div>
        {node.children?.length > 0 && (
          <div className="mt-1 rounded bg-white/20 px-2 py-0.5 text-[11px]">
            {node.children.length} nhánh con
          </div>
        )}
        {node.parentId && (
          <button
            type="button"
            onClick={() => onRemove(node.parentId, node.id)}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow hover:bg-red-700"
            title="Xóa nhánh này"
          >
            x
          </button>
        )}
        {!node.parentId && (
          <button
            type="button"
            onClick={() => onRemoveRoot(node.id)}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow hover:bg-red-700"
            title="Xóa sensor gốc này"
          >
            x
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onStartAdd(node.id)}
        className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-lg font-bold text-white shadow hover:bg-orange-600"
        title="Thêm nhánh con"
      >
        +
      </button>

      {isAdding && (
          <div className="mt-2 flex min-w-[230px] flex-col gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 shadow-sm sm:min-w-[260px]">
          <select
            value={childId}
            onChange={(e) => onChildChange(e.target.value)}
            className="min-h-10 rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            <option value="">Chọn sensor con</option>
            {sensors.map((sensor) => (
              <option key={sensor.id} value={sensor.id}>{sensor.name} - ID {sensor.id}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="button" onClick={onConfirmAdd} className="flex-1 rounded bg-orange-500 px-3 py-2 text-sm font-bold text-white hover:bg-orange-600">Thêm</button>
            <button type="button" onClick={onCancelAdd} className="flex-1 rounded bg-white px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100">Hủy</button>
          </div>
        </div>
      )}

      {node.children?.length > 0 && (
        <>
          <div className="h-6 w-px bg-orange-400" />
          <div className="flex gap-5 border-t-2 border-orange-400 px-3 pt-5 sm:gap-8 sm:px-5">
            {node.children.map((child) => (
              <SensorOrgNode
                key={child.id}
                node={{ ...child, parentId: node.id }}
                activeParentId={activeParentId}
                childId={childId}
                sensors={sensors}
                onStartAdd={onStartAdd}
                onChildChange={onChildChange}
                onConfirmAdd={onConfirmAdd}
                onCancelAdd={onCancelAdd}
                onRemove={onRemove}
                onRemoveRoot={onRemoveRoot}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const SensorBranch = ({ title, ids, sensorById, tone }) => {
  if (!ids.length) return null;

  const toneClass = tone === "blue"
    ? "border-blue-200 bg-blue-50 text-blue-800"
    : "border-teal-200 bg-teal-50 text-teal-800";

  return (
    <div className="ml-5 mt-2 border-l border-dashed border-gray-300 pl-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{title}</div>
      <div className="space-y-2">
        {ids.map((id) => {
          const sensor = sensorById[id];
          return (
            <div key={id} className={`rounded-lg border px-3 py-2 text-xs ${toneClass}`}>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">└</span>
                <span className="truncate font-bold">{sensor?.name || `Logger ${id}`}</span>
              </div>
              <div className="ml-5 mt-1 text-[11px] opacity-80">ID: {id} - Nhóm: {sensor?.group || "Không có"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DmaResultTree = ({ node, depth = 0 }) => (
  <div className={depth ? "mt-3 border-l border-dashed border-gray-300 pl-4" : "rounded-lg border border-gray-200 bg-white p-4 shadow-sm"}>
    {!depth && <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900"><FaSitemap className="text-teal-600" /> Cây cân bằng nước DMA</h3>}
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-gray-900">{node.name}</div>
        <div className={`rounded px-2 py-1 text-xs font-bold ${node.lossRate > 15 ? "bg-red-100 text-red-700" : "bg-teal-100 text-teal-700"}`}>
          Thất thoát {formatNumber(node.lossRate, 2)}%
        </div>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-gray-700 sm:grid-cols-4">
        <span>Vào: <b>{formatNumber(node.inletTotal)}</b> m3</span>
        <span>Tiêu thụ: <b>{formatNumber(node.consumeTotal)}</b> m3</span>
        <span>Xuống con: <b>{formatNumber(node.childInletTotal)}</b> m3</span>
        <span>Thất thoát tầng này: <b>{formatNumber(node.loss)}</b> m3</span>
      </div>
    </div>
    {!depth && node.sensorTree?.length > 0 && (
      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
        <div className="mb-3 font-bold text-blue-900">Cây thất thoát theo sensor</div>
        <SensorResultHierarchy nodes={node.sensorTree} />
      </div>
    )}
    {node.children?.map((child) => (
      <DmaResultTree key={child.dmaId} node={child} depth={depth + 1} />
    ))}
  </div>
);

const SensorResultHierarchy = ({ nodes, depth = 0 }) => (
  <div className="space-y-2">
    {nodes.map((sensor) => (
      <div key={`${sensor.id}-${depth}`} className={depth ? "border-l border-dashed border-blue-300 pl-3" : ""}>
        <div className="rounded-lg border border-white bg-white px-3 py-2 text-xs shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-gray-900">{sensor.name || `Logger ${sensor.id}`}</div>
            <div className={`rounded px-2 py-1 font-bold ${sensor.branchLossRate > 15 ? "bg-red-100 text-red-700" : "bg-teal-100 text-teal-700"}`}>
              {sensor.children?.length ? `Thất thoát ${formatNumber(sensor.branchLossRate, 2)}%` : "Nhánh cuối"}
            </div>
          </div>
          <div className="mt-2 grid gap-2 text-gray-700 sm:grid-cols-3">
            <span>Sản lượng: <b>{formatNumber(sensor.volume)}</b> m3</span>
            <span>Tổng con: <b>{formatNumber(sensor.childTotal)}</b> m3</span>
            <span>Thất thoát nhánh: <b>{formatNumber(sensor.branchLoss)}</b> m3</span>
          </div>
        </div>
        {sensor.children?.length > 0 && (
          <div className="ml-5 mt-2">
            <SensorResultHierarchy nodes={sensor.children} depth={depth + 1} />
          </div>
        )}
      </div>
    ))}
  </div>
);

const BranchAnalysisTable = ({ rows }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
    <div className="mb-3 flex items-center gap-2 font-bold text-gray-900">
      <FaSitemap className="text-blue-600" />
      Bảng phân tích từng nhánh sensor
    </div>
    <div className="max-h-[70vh] overflow-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border border-gray-300 p-2 text-left">Nhánh / sensor</th>
            <th className="border border-gray-300 p-2 text-left">Sensor cha</th>
            <th className="border border-gray-300 p-2 text-right">Sản lượng vào</th>
            <th className="border border-gray-300 p-2 text-right">Tổng nhánh con</th>
            <th className="border border-gray-300 p-2 text-right">Thất thoát nhánh</th>
            <th className="border border-gray-300 p-2 text-right">Tỷ lệ</th>
            <th className="border border-gray-300 p-2 text-center">Loại</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hasChildren = row.children?.length > 0;
            return (
              <tr key={`${row.id}-${row.depth}`} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-2">
                  <div className="font-semibold text-gray-800" style={{ paddingLeft: row.depth * 18 }}>
                    {row.depth ? "└ " : ""}
                    {row.name || `Logger ${row.id}`}
                  </div>
                  <div className="text-xs text-gray-500" style={{ paddingLeft: row.depth * 18 }}>ID: {row.id}</div>
                </td>
                <td className="border border-gray-300 p-2 text-gray-600">{row.parentName || "Gốc DMA"}</td>
                <td className="border border-gray-300 p-2 text-right font-semibold">{formatNumber(row.volume)}</td>
                <td className="border border-gray-300 p-2 text-right">{formatNumber(row.childTotal)}</td>
                <td className={`border border-gray-300 p-2 text-right font-semibold ${row.branchLoss > 0 ? "text-red-600" : "text-teal-700"}`}>
                  {hasChildren ? formatNumber(row.branchLoss) : "-"}
                </td>
                <td className={`border border-gray-300 p-2 text-right font-semibold ${row.branchLossRate > 15 ? "text-red-600" : "text-teal-700"}`}>
                  {hasChildren ? `${formatNumber(row.branchLossRate, 2)}%` : "-"}
                </td>
                <td className="border border-gray-300 p-2 text-center">
                  <span className={`rounded px-2 py-1 text-xs font-bold ${hasChildren ? "bg-blue-50 text-blue-700" : "bg-teal-50 text-teal-700"}`}>
                    {hasChildren ? `${row.children.length} nhánh con` : "Nhánh cuối"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const ResultPanel = ({ title, icon, rows }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
    <div className="mb-3 flex items-center gap-2 font-bold text-gray-800">{icon}{title}</div>
    <LoggerResultTable rows={rows} />
  </div>
);

const LoggerResultTable = ({ rows }) => (
  <div className="max-h-[70vh] overflow-auto">
    <table className="min-w-full border-collapse text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="border border-gray-300 p-2 text-left">Logger</th>
          <th className="border border-gray-300 p-2 text-right">Sản lượng (m3)</th>
          <th className="border border-gray-300 p-2 text-right">Min flow</th>
          <th className="border border-gray-300 p-2 text-right">Avg flow</th>
          <th className="border border-gray-300 p-2 text-center">Dữ liệu</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-gray-50">
            <td className="border border-gray-300 p-2">
              <div className="font-semibold text-gray-800">{row.name}</div>
              <div className="text-xs text-gray-500">ID: {row.id}</div>
            </td>
            <td className="border border-gray-300 p-2 text-right font-semibold">{formatNumber(row.volume)}</td>
            <td className="border border-gray-300 p-2 text-right">{formatNumber(row.minFlow, 2)}</td>
            <td className="border border-gray-300 p-2 text-right">{formatNumber(row.avgFlow, 2)}</td>
            <td className="border border-gray-300 p-2 text-center">{row.hasData ? "Có" : "Không"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default DmaLoss;
