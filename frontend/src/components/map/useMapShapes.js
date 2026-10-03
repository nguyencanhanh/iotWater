import { useCallback, useEffect, useState } from "react";
import { mapShapeCreatePost, mapShapeDelete, mapShapeUpdatePut, mapShapesGet } from "../../api/index";

const getToken = () => localStorage.getItem("token");
const errorText = (requestError, fallback) => requestError.response?.data?.error || fallback;

// Vung / duong ong ve tren ban do (luu tren server, moi nguoi cung thay).
const useMapShapes = ({ user, canEdit }) => {
  const [shapes, setShapes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await mapShapesGet(getToken(), user);
      setShapes(res.data?.shapes || []);
    } catch (requestError) {
      setError(errorText(requestError, "Không tải được vùng / đường ống"));
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Tra ve hinh da luu, hoac null (loi dat vao error).
  const save = useCallback(async (payload, existing) => {
    if (!canEdit) {
      setError("Tài khoản của bạn không có quyền vẽ");
      return null;
    }
    setSaving(true);
    setError("");
    try {
      const body = { ...payload, user };
      if (existing?._id) {
        const res = await mapShapeUpdatePut(getToken(), existing._id, body);
        const shape = res.data?.shape;
        setShapes((prev) => prev.map((item) => (item._id === shape._id ? shape : item)));
        return shape;
      }
      const res = await mapShapeCreatePost(getToken(), body);
      const shape = res.data?.shape;
      if (shape) setShapes((prev) => [...prev, shape]);
      return shape;
    } catch (requestError) {
      setError(errorText(requestError, "Không lưu được hình vẽ"));
      return null;
    } finally {
      setSaving(false);
    }
  }, [canEdit, user]);

  const remove = useCallback(async (shape) => {
    if (!canEdit || !shape?._id) return false;
    try {
      await mapShapeDelete(getToken(), shape._id, user);
      setShapes((prev) => prev.filter((item) => item._id !== shape._id));
      return true;
    } catch (requestError) {
      setError(errorText(requestError, "Không xoá được hình vẽ"));
      return false;
    }
  }, [canEdit, user]);

  return { shapes, saving, error, setError, load, save, remove };
};

export default useMapShapes;
