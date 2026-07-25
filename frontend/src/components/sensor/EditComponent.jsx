import React, { useEffect, useState, useRef } from "react";
import { sensorUpdateGet, sensorUpdatePut, uploadLoggerImage, getLoggerImageUrl } from "../../api/index";
import { produce } from "immer";

function EditComponent({ step, id, setIsEdit }) {
    const [sensor, setSensor] = useState(null);
    const [sensorLoading, setSensorLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [hasImage, setHasImage] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fetchSensor = async () => {
            setSensorLoading(true);
            try {
                const res = await sensorUpdateGet(localStorage.getItem("token"), { id: id });
                if (res.data.success) {
                    setSensor(res.data.sensor);
                    if (res.data.sensor?.image) {
                        setHasImage(true);
                    }
                }
            } catch (error) {
                if (error.response && !error.response.data.success) {
                    alert(error.response.data.error);
                }
            } finally {
                setSensorLoading(false);
            }
        };
        fetchSensor();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSensor({ ...sensor, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await sensorUpdatePut(localStorage.getItem("token"), {
                sen_name: sensor.name,
                sen_description: sensor.description,
                id: id,
            });
            if (res.data.success) {
                alert("Cập nhật thông tin cảm biến thành công");
            }
        } catch (error) {
            if (error.response && !error.response.data.success) {
                alert(error.response.data.error);
            }
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleUploadImage = async () => {
        if (!selectedFile) {
            alert("Vui lòng chọn ảnh trước");
            return;
        }
        setUploading(true);
        try {
            const res = await uploadLoggerImage(localStorage.getItem("token"), id, selectedFile);
            if (res.data.success) {
                alert("Upload ảnh thành công!");
                setHasImage(true);
                setSelectedFile(null);
                setPreviewUrl(null);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Lỗi khi upload ảnh!");
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            {sensorLoading ? (
                <p>Loading...</p>
            ) : (
                <>
                    {/* Lớp phủ để đóng modal khi click ra ngoài */}
                    <div 
                        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[1px]"
                        onClick={() => setIsEdit(prevData =>
                            produce(prevData, draft => {
                                draft[step] = false;
                            })
                        )}
                    />
                    <div className="fixed left-1/2 top-1/2 z-[61] max-h-[90vh] w-[min(96vw,56rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
                    {/* Nút đóng ở góc phải trên cùng */}
                    <button
                        onClick={() => setIsEdit(prevData =>
                            produce(prevData, draft => {
                                draft[step] = !draft[step];
                            })
                        )}
                        className="absolute right-3 top-3 rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                    >
                        ✖
                    </button>

                    <div className="mb-5 text-center text-2xl font-bold">
                        <h3>Thông tin cảm biến</h3>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <div className="mb-4">
                                <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                                    Tên cảm biến
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="Enter Dep name"
                                    className="min-h-11 w-full rounded-md border border-gray-300 p-2.5"
                                    value={sensor?.name || ""}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                    Ghi chú cảm biến
                                </label>
                                <textarea
                                    name="description"
                                    placeholder="Description"
                                    rows="8"
                                    className="mt-1 block w-full rounded-md border border-gray-300 p-2.5"
                                    value={sensor?.description || ""}
                                    onChange={handleChange}
                                ></textarea>
                            </div>
                            <button
                                type="submit"
                                className="mt-4 w-full rounded bg-teal-600 px-4 py-3 font-bold text-white hover:bg-teal-700"
                            >
                                Xác nhận sửa thông tin
                            </button>
                        </form>

                        {/* Phần upload ảnh */}
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <h4 className="mb-3 text-lg font-semibold">📷 Ảnh Logger</h4>

                            {/* Hiển thị ảnh hiện tại */}
                            {hasImage && !previewUrl && (
                                <div className="mb-3">
                                    <img
                                        src={getLoggerImageUrl(id)}
                                        alt={`Logger ${id}`}
                                        className="h-64 w-full rounded-md border border-gray-300 object-cover"
                                        onError={(e) => { e.target.style.display = 'none'; setHasImage(false); }}
                                    />
                                </div>
                            )}

                            {/* Hiển thị preview ảnh mới chọn */}
                            {previewUrl && (
                                <div className="mb-3">
                                    <p className="mb-1 text-sm text-gray-500">Ảnh mới:</p>
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="h-64 w-full rounded-md border-2 border-teal-500 object-cover"
                                    />
                                </div>
                            )}

                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current.click()}
                                    className="flex-1 rounded bg-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-300"
                                >
                                    📁 Chọn ảnh
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUploadImage}
                                    disabled={!selectedFile || uploading}
                                    className={`flex-1 rounded px-3 py-2 text-sm text-white ${
                                        !selectedFile || uploading
                                            ? 'cursor-not-allowed bg-gray-400'
                                            : 'bg-teal-600 hover:bg-teal-700'
                                    }`}
                                >
                                    {uploading ? '⏳ Đang tải...' : '⬆️ Tải lên'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
            )}
        </>

    );
}

export default EditComponent;
