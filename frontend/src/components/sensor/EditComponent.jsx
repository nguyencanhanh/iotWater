import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {sensorUpdateGet, sensorUpdatePut} from "../../api/index"

function EditComponent() {
    const { id } = useParams()
    const [sensor, setSensor] = useState('')
    const [sensorLoading, setsensorLoading] = useState(false)
    const navigate = useNavigate()
    useEffect(() => {
        const fetchDeoartments = async () => {
            setsensorLoading(true);
            try {
                const res = await sensorUpdateGet(localStorage.getItem("token"), id)
                if (res.data.success) {
                    console.log(res.data.sensor)
                    setSensor(res.data.sensor);
                }
            } catch (error) {
                if (error.res && !error.res.data.success) {
                    alert(error.res.data.error);
                }
            } finally {
                setsensorLoading(false);
            }
        };
        fetchDeoartments();
    }, []);
    const handleChange = (e) => {
        const { value } = e.target;
        setSensor(value);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            console.log(sensor)
            const res = await sensorUpdatePut(localStorage.getItem("token"), id, { sen_name: sensor })
            if (res.data.success) {
                console.log(res.data)
                navigate("/admin-dashboard/sensors");
            }
        } catch (error) {
            if (error.res && !error.res.data.success) {
                alert(error.res.data.error);
            }
        }
    }
    return (
        <>{sensorLoading ? <p>Loading...</p> :
            <div className="max-w-3xl mx-auto mt-10 bg-white p-8 rounded-md shadow-md w-96">
                <div className="text-2xl font-bold mb-6">
                    <h3>Edit Sensor</h3>
                </div>
                <form onSubmit={handleSubmit} >
                    <div>
                        <label
                            htmlFor="dep_name"
                            className="text-sm font-medium text-gray-700"
                        >
                            Sensor Name
                        </label>
                        <input
                            type="text"
                            placeholder="Enter Dep name"
                            className="mt-1 w-full border border-gray-300 rounded-md p-2"
                            value={sensor}
                            onChange={handleChange}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 font-bold rounded"
                    >
                        Edit Sensor
                    </button>
                </form>
            </div>
        }</>
    )
}

export default EditComponent