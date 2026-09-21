import { useCallback, useEffect, useMemo, useState } from "react";
import {
  mapPointCreatePost,
  mapPointDelete,
  mapPointHotspotsGet,
  mapPointUpdatePut,
  mapPointsGet,
} from "../../api/index";

const getToken = () => localStorage.getItem("token");

const useMapPoints = ({ user, enabled = true, canEdit = true }) => {
  const [points, setPoints] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadPoints = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError("");
    try {
      const res = await mapPointsGet(getToken(), { user, type: typeFilter, status: statusFilter });
      setPoints(res.data?.points || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Không tải được danh sách điểm");
    } finally {
      setLoading(false);
    }
  }, [enabled, user, typeFilter, statusFilter]);

  const loadHotspots = useCallback(async () => {
    try {
      const res = await mapPointHotspotsGet(getToken(), { user, type: typeFilter });
      setHotspots(res.data?.hotspots || []);
    } catch {
      setHotspots([]);
    }
  }, [user, typeFilter]);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  const savePoint = useCallback(async (payload, existing) => {
    if (!canEdit) {
      setError("Tài khoản của bạn không có quyền chỉnh sửa điểm");
      return false;
    }

    setSaving(true);
    setError("");
    try {
      const body = { ...payload, user };
      if (existing?._id) {
        const res = await mapPointUpdatePut(getToken(), existing._id, body);
        const updated = res.data?.point;
        setPoints((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      } else {
        const res = await mapPointCreatePost(getToken(), body);
        const created = res.data?.point;
        if (created) setPoints((prev) => [created, ...prev]);
      }
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Không lưu được điểm");
      return false;
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
      setError(requestError.response?.data?.error || "Không xoá được điểm");
      return false;
    } finally {
      setSaving(false);
    }
  }, [canEdit, user]);

  const stats = useMemo(() => ({
    total: points.length,
    open: points.filter((point) => point.status === "open").length,
    inProgress: points.filter((point) => point.status === "in_progress").length,
    resolved: points.filter((point) => point.status === "resolved").length,
  }), [points]);

  const groups = useMemo(
    () => [...new Set(points.map((point) => point.group).filter(Boolean))].sort(),
    [points]
  );

  return {
    points,
    hotspots,
    groups,
    stats,
    loading,
    saving,
    error,
    setError,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    reload: loadPoints,
    loadHotspots,
    savePoint,
    removePoint,
  };
};

export default useMapPoints;
