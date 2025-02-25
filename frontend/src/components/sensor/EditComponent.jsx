import React, { useEffect, useState } from "react";
import { sensorUpdateGet, sensorUpdatePut } from "../../api/index";

function EditComponent({ id }) {
    const [sensor, setSensor] = useState(null);
    const [sensorLoading, setSensorLoading] = useState(false);

    useEffect(() => {
        const fetchSensor = async () => {
            setSensorLoading(true);
            try {
                const res = await sensorUpdateGet(localStorage.getItem("token"), {id: id});
                if (res.data.success) {
                    setSensor(res.data.sensor);
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
                id: sensor.id,
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

    return (
        <>
            {sensorLoading ? (
                <p>Loading...</p>
            ) : (
                <div className="absolute bg-white p-6 rounded-md shadow-lg w-96">
                    <div className="text-2xl font-bold mb-4">
                        <h3>Thông tin cảm biến</h3>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="name" className="text-sm font-medium text-gray-700">
                                Department Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                placeholder="Enter Dep name"
                                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                                value={sensor?.name || ""}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                Description
                            </label>
                            <textarea
                                name="description"
                                placeholder="Description"
                                rows="4"
                                className="mt-1 p-2 w-full border border-gray-300 rounded-md block"
                                value={sensor?.description || ""}
                                onChange={handleChange}
                            ></textarea>
                        </div>
                        <button
                            type="submit"
                            className="w-full mt-4 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 font-bold rounded"
                        >
                            Xác nhận sửa thông tin
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}

export default EditComponent;
