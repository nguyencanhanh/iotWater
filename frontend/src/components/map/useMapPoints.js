import { useCallback, useEffect, useMemo, useState } from "react";
import {
  incidentTypeCreatePost,
  incidentTypesGet,
  mapPointCreatePost,
  mapPointDelete,
  mapPointHotspotsGet,
  mapPointImageDelete,
  mapPointImagesPost,
  mapPointUpdatePut,
  mapPointsGet,
} from "../../api/index";

const getToken = () => localStorage.getItem("token");

const useMapPoints = ({ user, enabled = true, canEdit = true }) => {
  const [points, setPoints] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingType, setCreatingType] = useState(false);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadPoints = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError("");
    try {
      const res = await mapPointsGet(getToken(), { user, typeId: typeFilter, status: statusFilter });
      setPoints(res.data?.points || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Không tải được danh sách sự cố");
    } finally {
      setLoading(false);
    }
  }, [enabled, user, typeFilter, statusFilter]);

  const loadTypes = useCallback(async () => {
    try {
      const res = await incidentTypesGet(getToken(), user);
      setTypes(res.data?.types || []);
    } catch {
      setTypes([]);
    }
  }, [user]);

  const loadHotspots = useCallback(async () => {
    try {
      const res = await mapPointHotspotsGet(getToken(), { user, typeId: typeFilter });
      setHotspots(res.data?.hotspots || []);
    } catch {
      setHotspots([]);
    }
  }, [user, typeFilter]);

  useEffect(() => { loadPoints(); }, [loadPoints]);
  useEffect(() => { loadTypes(); }, [loadTypes]);

  // Tra ve _id de form chon luon loai vua tao.
  const createType = useCallback(async (name) => {
    if (!canEdit) {
      setError("Tài khoản của bạn không có quyền thêm loại sự cố");
      return null;
    }
    setCreatingType(true);
    try {
      const res = await incidentTypeCreatePost(getToken(), { user, name });
      const created = res.data?.type;
      if (created) {
        setTypes((prev) => (prev.some((item) => String(item._id) === String(created._id))
          ? prev
          : [...prev, created]));
        return String(created._id);
      }
      return null;
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Không thêm được loại sự cố");
      return null;
    } finally {
      setCreatingType(false);
    }
  }, [canEdit, user]);

  const savePoint = useCallback(async (payload, existing) => {
    if (!canEdit) {
      setError("Tài khoản của bạn không có quyền chỉnh sửa sự cố");
      return null;
    }

    setSaving(true);
    setError("");
    try {
      const body = { ...payload, user };
      if (existing?._id) {
        const res = await mapPointUpdatePut(getToken(), existing._id, body);
        const updated = res.data?.point;
        setPoints((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
        return updated;
      }
      const res = await mapPointCreatePost(getToken(), body);
      const created = res.data?.point;
      if (created) setPoints((prev) => [created, ...prev]);
      return created;
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Không lưu được sự cố");
      return null;
    } finally {
      setSaving(false);
    }
  }, [canEdit, user]);

  const removePoint = useCallback(async (point) => {
    if (!canEdit || !point?._id) return false;
    setSaving(true);
    setError("");
    try {
      await mapPointDelete(getToken(), point._id, user);
      setPoints((prev) => prev.filter((item) => item._id !== point._id));
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Không xoá được sự cố");
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
      setError(requestError.response?.data?.error || "Không tải được ảnh lên");
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
      setError(requestError.response?.data?.error || "Không xoá được ảnh");
      return null;
    } finally {
      setSaving(false);
    }
  }, [canEdit, user]);

  const stats = useMemo(() => ({
    total: points.length,
    open: points.filter((point) => point.status === "open").length,
    resolved: points.filter((point) => point.status === "resolved").length,
  }), [points]);

  const groups = useMemo(
    () => [...new Set(points.map((point) => point.group).filter(Boolean))].sort(),
    [points]
  );

  return {
    points,
    hotspots,
    types,
    groups,
    stats,
    loading,
    saving,
    creatingType,
    error,
    setError,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    reload: loadPoints,
    loadTypes,
    loadHotspots,
    createType,
    savePoint,
    removePoint,
    uploadImages,
    removeImage,
  };
};

export default useMapPoints;
