import React, { useState, useEffect, useMemo } from "react";
import { getGroup, changeGroup, deleteGroup, addGroup } from "../../api";
import { useAuth } from '../../context/authContext';

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);
const IconSearch = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);
const IconArrowRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
  </svg>
);
const IconX = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
const IconUsers = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
);

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <div className="animate-pulse flex items-center gap-3 p-3 border-b border-gray-100">
    <div className="h-4 bg-gray-200 rounded w-1/2" />
    <div className="ml-auto h-4 bg-gray-200 rounded w-16" />
  </div>
);

// ─── Badge ────────────────────────────────────────────────────────────────────
const Badge = ({ count }) => (
  <span className="ml-auto inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
    {count}
  </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GroupNameTable({ embedded = false }) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState([]);          // [{name, group}]
  const [groups, setGroups] = useState([]);       // group name strings
  const [newGroup, setNewGroup] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // group to confirm delete

  const token = localStorage.getItem("token");

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchGroups = async () => {
    if (authLoading || !user) return;  // Chờ auth load xong
    setLoading(true);
    try {
      const res = await getGroup(token, 0);
      setGroups(res.data.group);
      setData(res.data.sen_group);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Chạy lại fetch khi auth state thay đổi (authLoading: true→false sau khi verify xong)
  useEffect(() => { fetchGroups(); }, [authLoading]);

  // ── derived data ───────────────────────────────────────────────────────────
  const loggersByGroup = useMemo(() => {
    const map = {};
    groups.forEach(g => { map[g] = []; });
    data.forEach(item => {
      if (map[item.group] !== undefined) map[item.group].push(item.name);
    });
    return map;
  }, [data, groups]);

  const inGroup = useMemo(() => {
    if (!selectedGroup) return [];
    return data.filter(d => d.group === selectedGroup);
  }, [data, selectedGroup]);

  const notInGroup = useMemo(() => {
    if (!selectedGroup) return [];
    return data.filter(d => d.group !== selectedGroup);
  }, [data, selectedGroup]);

  const filteredIn = useMemo(() =>
    inGroup.filter(d => d.name.toLowerCase().includes(search.toLowerCase())),
    [inGroup, search]);

  const filteredOut = useMemo(() =>
    notInGroup.filter(d => d.name.toLowerCase().includes(search.toLowerCase())),
    [notInGroup, search]);

  // ── actions ────────────────────────────────────────────────────────────────
  const isTrial = () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử');
      return true;
    }
    return false;
  };

  const moveLogger = async (loggerName, toGroup) => {
    if (isTrial()) return;
    try {
      const res = await changeGroup(token, { newGroup: toGroup, name: loggerName, user: 0 });
      if (res.data.success) {
        setData(prev => prev.map(item =>
          item.name === loggerName ? { ...item, group: toGroup } : item
        ));
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi chuyển nhóm');
    }
  };

  const handleAddGroup = async () => {
    if (isTrial()) return;
    const trimmed = newGroup.trim();
    if (!trimmed || groups.includes(trimmed)) return;
    setAdding(true);
    try {
      await addGroup(token, { newGroup: trimmed, user: 0 });
      setGroups(prev => [...prev, trimmed]);
      setNewGroup("");
      setSelectedGroup(trimmed);
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi thêm nhóm');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteGroup = async (groupName) => {
    if (isTrial()) return;
    try {
      const res = await deleteGroup(token, { groupToRemove: groupName, user: 0 });
      if (res.data.success) {
        setGroups(prev => prev.filter(g => g !== groupName));
        setData(prev => prev.map(item =>
          item.group === groupName ? { ...item, group: "Không có" } : item
        ));
        if (selectedGroup === groupName) setSelectedGroup(null);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi xóa nhóm');
    } finally {
      setConfirmDelete(null);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={embedded ? "bg-transparent" : "min-h-screen bg-gray-50 p-4 md:p-6"}>

      {/* Header */}
      {!embedded && <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">⚙️ Quản lý Nhóm Logger</h1>
        <p className="text-sm text-gray-500 mt-1">Phân nhóm và quản lý các logger trong hệ thống</p>
      </div>}

      <div className={`flex gap-4 ${embedded ? "h-[calc(100vh-260px)] min-h-[560px]" : "h-[calc(100vh-160px)]"}`}>

        {/* ── LEFT PANEL: Group List ─────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Danh sách nhóm</span>
          </div>

          {/* Add Group Form */}
          <div className="p-3 border-b border-gray-100 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Tên nhóm mới..."
                value={newGroup}
                onChange={e => setNewGroup(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
              />
              <button
                onClick={handleAddGroup}
                disabled={adding || !newGroup.trim()}
                className="flex items-center justify-center p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg transition-colors"
                title="Thêm nhóm"
              >
                {adding ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <IconPlus />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            ) : (
              groups.map(group => {
                const isSelected = selectedGroup === group;
                const count = (loggersByGroup[group] || []).length;
                const isSpecial = group === "Không có";
                return (
                  <button
                    key={group}
                    onClick={() => { setSelectedGroup(group); setSearch(""); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                        : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <IconUsers />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                        {group}
                      </p>
                      <p className="text-xs text-gray-400">{count} logger</p>
                    </div>
                    <Badge count={count} />
                    {!isSpecial && (
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(group); }}
                        className="ml-1 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Xóa nhóm"
                      >
                        <IconTrash />
                      </button>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: Logger Management ──────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {!selectedGroup ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <IconUsers />
              <p className="mt-3 text-lg font-medium">Chọn một nhóm để quản lý</p>
              <p className="text-sm">Bấm vào tên nhóm ở cột bên trái để xem và chỉnh sửa</p>
            </div>
          ) : (
            <>
              {/* Search bar */}
              <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow border border-gray-100">
                <div className="text-blue-500"><IconSearch /></div>
                <input
                  type="text"
                  placeholder={`Tìm kiếm logger trong nhóm "${selectedGroup}"...`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
                    <IconX />
                  </button>
                )}
              </div>

              <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">

                {/* IN GROUP */}
                <div className="bg-white rounded-2xl shadow border border-gray-100 flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-green-50 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                        ✅ Đang trong nhóm
                      </span>
                      <span className="ml-2 text-xs text-green-600">— {selectedGroup}</span>
                    </div>
                    <Badge count={inGroup.length} />
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                    {filteredIn.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-gray-300 text-sm">
                        <p>Không có logger nào</p>
                      </div>
                    ) : filteredIn.map(item => (
                      <div key={item.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group">
                        <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                        <span className="flex-1 text-sm text-gray-700 font-medium truncate">{item.name}</span>
                        <button
                          onClick={() => moveLogger(item.name, "Không có")}
                          title="Bỏ khỏi nhóm"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <IconX />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NOT IN GROUP */}
                <div className="bg-white rounded-2xl shadow border border-gray-100 flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-orange-50 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-orange-700 uppercase tracking-wider">
                        📦 Chưa trong nhóm này
                      </span>
                    </div>
                    <Badge count={notInGroup.length} />
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                    {filteredOut.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-gray-300 text-sm">
                        <p>Tất cả đã trong nhóm</p>
                      </div>
                    ) : filteredOut.map(item => (
                      <div key={item.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 group">
                        <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-400 truncate">Nhóm: {item.group}</p>
                        </div>
                        <button
                          onClick={() => moveLogger(item.name, selectedGroup)}
                          title={`Thêm vào "${selectedGroup}"`}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <IconArrowRight />
                          <span>Thêm</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </>
          )}
        </div>

      </div>

      {/* ── Confirm Delete Modal ──────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">⚠️ Xác nhận xóa nhóm</h3>
            <p className="text-sm text-gray-600 mb-1">
              Bạn có chắc muốn xóa nhóm <strong className="text-red-600">"{confirmDelete}"</strong> không?
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Tất cả logger trong nhóm này sẽ được chuyển về "Không có".
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDeleteGroup(confirmDelete)}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Xóa nhóm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
