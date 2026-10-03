import { useCallback, useEffect, useMemo, useState } from "react";
import {
  incidentGroupCreatePost,
  incidentGroupDelete,
  incidentGroupUpdatePut,
  incidentGroupsGet,
  incidentMethodCreatePost,
  incidentMethodDelete,
  incidentMethodUpdatePut,
  incidentMethodsGet,
  incidentTypeCreatePost,
  incidentTypeDelete,
  incidentTypeUpdatePut,
  incidentTypesGet,
  mapPointCreatePost,
  mapPointDelete,
  mapPointHotspotsGet,
  mapPointImageDelete,
  mapPointImagesPost,
  mapPointUpdatePut,
  mapPointsGet,
} from "../../api/index";
import { DEFAULT_TIME_FILTER, currentMonthKey, resolveTimeRange } from "./mapPointMeta";

const getToken = () => localStorage.getItem("token");
const errorText = (requestError, fallback) => requestError.response?.data?.error || fallback;

// Danh muc cua diem su co (loai su co 2 bac, khu vuc / tuyen 2 bac, loai hinh phat hien).
// create tra ve muc vua tao (hoac null); update / remove tra ve null neu thanh cong, hoac chuoi loi.
const useCatalog = ({ user, canEdit, api, label, onChanged }) => {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.list(getToken(), user);
      setItems(res.data?.items || []);
    } catch {
      setItems([]);
    }
  }, [api, user]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (name, parentId = null, extra = {}) => {
    if (!canEdit) return { error: `Tài khoản của bạn không có quyền thêm ${label}` };
    setBusy(true);
    try {
      const res = await api.create(getToken(), { user, name, parentId, ...extra });
      const item = res.data?.item;
      if (item) setItems((prev) => (prev.some((row) => String(row._id) === String(item._id)) ? prev : [...prev, item]));
      return { item };
    } catch (requestError) {
      return { error: errorText(requestError, `Không thêm được ${label}`) };
    } finally {
      setBusy(false);
    }
  }, [api, canEdit, label, user]);

  const update = useCallback(async (id, patch) => {
    if (!canEdit) return `Tài khoản của bạn không có quyền sửa ${label}`;
    try {
      const res = await api.update(getToken(), id, { user, ...patch });
      const item = res.data?.item;
      if (item) setItems((prev) => prev.map((row) => (String(row._id) === String(id) ? item : row)));
      // Doi ten / chuyen nhom thi server da dong bo ten tren cac diem -> tai lai diem.
      if (patch.name !== undefined || patch.parentId !== undefined) onChanged?.();
      return null;
    } catch (requestError) {
      return errorText(requestError, `Không sửa được ${label}`);
    }
  }, [api, canEdit, label, onChanged, user]);

  const remove = useCallback(async (id) => {
    if (!canEdit) return `Tài khoản của bạn không có quyền xoá ${label}`;
    try {
      await api.remove(getToken(), id, user);
      setItems((prev) => prev.filter((row) => String(row._id) !== String(id)));
      return null;
    } catch (requestError) {
      return errorText(requestError, `Không xoá được ${label}`);
    }
  }, [api, canEdit, label, user]);

  return { items, busy, load, create, update, remove };
};

const TYPE_API = { list: incidentTypesGet, create: incidentTypeCreatePost, update: incidentTypeUpdatePut, remove: incidentTypeDelete };
const GROUP_API = { list: incidentGroupsGet, create: incidentGroupCreatePost, update: incidentGroupUpdatePut, remove: incidentGroupDelete };
const METHOD_API = { list: incidentMethodsGet, create: incidentMethodCreatePost, update: incidentMethodUpdatePut, remove: incidentMethodDelete };

const useMapPoints = ({ user, enabled = true, canEdit = true }) => {
  const [points, setPoints] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState(DEFAULT_TIME_FILTER);
  // Doi sang thang moi khi trang dang mo (qua nua dem cuoi thang) -> tu tai lai.
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  useEffect(() => {
    const timer = setInterval(() => setMonthKey(currentMonthKey()), 60000);
    return () => clearInterval(timer);
  }, []);

  // monthKey trong deps de "Thang nay" duoc tinh lai khi sang thang.
  const timeRange = useMemo(() => resolveTimeRange(timeFilter), [timeFilter, monthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPoints = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError("");
    try {
      // Lay ca luot "khong thay diem" (bang tra cuu can); ban do tu loc kind.
      const res = await mapPointsGet(getToken(), {
        user,
        typeId: typeFilter,
        status: statusFilter,
        fromDate: timeRange.fromDate,
        toDate: timeRange.toDate,
      });
      setPoints(res.data?.points || []);
    } catch (requestError) {
      setError(errorText(requestError, "Không tải được danh sách sự cố"));
    } finally {
      setLoading(false);
    }
  }, [enabled, user, typeFilter, statusFilter, timeRange]);

  useEffect(() => { loadPoints(); }, [loadPoints]);

  const typeCatalog = useCatalog({ user, canEdit, api: TYPE_API, label: "loại sự cố", onChanged: loadPoints });
  const groupCatalog = useCatalog({ user, canEdit, api: GROUP_API, label: "khu vực / tuyến", onChanged: loadPoints });
  const methodCatalog = useCatalog({ user, canEdit, api: METHOD_API, label: "loại hình phát hiện", onChanged: loadPoints });

  const loadHotspots = useCallback(async () => {
    try {
      const res = await mapPointHotspotsGet(getToken(), {
        user,
        typeId: typeFilter,
        fromDate: timeRange.fromDate,
        toDate: timeRange.toDate,
      });
      setHotspots(res.data?.hotspots || []);
    } catch {
      setHotspots([]);
    }
  }, [user, typeFilter, timeRange]);

  const savePoint = useCallback(async (payload, existing) => {
    if (!canEdit) {
      setError("Tài khoản của bạn không có quyền chỉnh sửa sự cố");
      return null;
    }

    setSaving(true);
    setError("");
    try {
      const body = { ...payload, user };
      let saved;
      if (existing?._id) {
        const res = await mapPointUpdatePut(getToken(), existing._id, body);
        saved = res.data?.point;
        setPoints((prev) => prev.map((item) => (item._id === saved._id ? saved : item)));
      } else {
        const res = await mapPointCreatePost(getToken(), body);
        saved = res.data?.point;
        if (saved) setPoints((prev) => [saved, ...prev]);
      }
      // So khach hang cua tuyen co the vua doi trong form -> tai lai danh muc.
      if (payload.routeId) groupCatalog.load();
      return saved;
    } catch (requestError) {
      setError(errorText(requestError, "Không lưu được sự cố"));
      return null;
    } finally {
      setSaving(false);
    }
  }, [canEdit, groupCatalog, user]);

  const removePoint = useCallback(async (point) => {
    if (!canEdit || !point?._id) return false;
    setSaving(true);
    setError("");
    try {
      await mapPointDelete(getToken(), point._id, user);
      setPoints((prev) => prev.filter((item) => item._id !== point._id));
      return true;
    } catch (requestError) {
      setError(errorText(requestError, "Không xoá được sự cố"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [canEdit, user]);

  const uploadImages = useCallback(async (point, files) => {
    if (!canEdit || !point?._id) return null;
    setSaving(true);
    setError("");
    try {
      const res = await mapPointImagesPost(getToken(), point._id, files, user);
      const updated = res.data?.point;
      if (updated) setPoints((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      return updated;
    } catch (requestError) {
      setError(errorText(requestError, "Không tải được ảnh lên"));
      return null;
    } finally {
      setSaving(false);
    }
  }, [canEdit, user]);

  const removeImage = useCallback(async (point, name) => {
    if (!canEdit || !point?._id) return null;
    setSaving(true);
    try {
      const res = await mapPointImageDelete(getToken(), point._id, name, user);
      const updated = res.data?.point;
      if (updated) setPoints((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      return updated;
    } catch (requestError) {
      setError(errorText(requestError, "Không xoá được ảnh"));
      return null;
    } finally {
      setSaving(false);
    }
  }, [canEdit, user]);

  // Diem tren ban do (bo luot "da nghe nhung khong tim thay diem"), kem bieu tuong cua loai.
  const iconByType = useMemo(
    () => Object.fromEntries(typeCatalog.items.map((type) => [String(type._id), type.icon || "drop"])),
    [typeCatalog.items]
  );
  const mapPoints = useMemo(
    () => points
      .filter((point) => point.kind !== "no_find")
      .map((point) => ({ ...point, typeIcon: iconByType[String(point.typeId)] || "drop" })),
    [points, iconByType]
  );

  const stats = useMemo(() => ({
    total: mapPoints.length,
    open: mapPoints.filter((point) => point.status === "open").length,
    resolved: mapPoints.filter((point) => point.status === "resolved").length,
    noFind: points.length - mapPoints.length,
  }), [mapPoints, points.length]);

  // Ten khu vuc bac 1 (bo loc khu vuc o phan bao cao).
  const areaNames = useMemo(
    () => groupCatalog.items.filter((item) => !item.parentId).map((item) => item.name),
    [groupCatalog.items]
  );

  return {
    points,
    mapPoints,
    hotspots,
    types: typeCatalog.items,
    typeCatalog,
    groupCatalog,
    methodCatalog,
    areaNames,
    stats,
    loading,
    saving,
    error,
    setError,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    timeFilter,
    setTimeFilter,
    timeLabel: timeRange.label,
    reload: loadPoints,
    loadHotspots,
    savePoint,
    removePoint,
    uploadImages,
    removeImage,
  };
};

export default useMapPoints;
