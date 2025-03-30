import React, { useState } from "react";
import { sensorAddPost } from "../../api/index";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../../context/authContext'

function Addsensor() {
  const { user, info } = useAuth()
  const [sensor, setsensor] = useState({
    sen_name: "",
    description: "",
    id: info.length
  });
  const navigate = useNavigate();
  const handleChange = (e) => {
    const { name, value } = e.target;
    setsensor({ ...sensor, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await sensorAddPost(localStorage.getItem("token"), sensor)
      if (res.data.success) {
        navigate("/admin-dashboard/sensors");
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };
  
  return (
    <div className="max-w-3xl mx-auto mt-10 bg-white p-8 rounded-md shadow-md w-96">
      <div className="text-2xl font-bold mb-6">
        <h3>Thêm cảm biến</h3>
      </div>
      <form onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="sen_name"
            className="text-sm font-medium text-gray-700"
          >
            Tên cảm biến
          </label>
          <input
            type="text"
            name="sen_name"
            placeholder="Enter Dep name"
            className="mt-1 w-full border border-gray-300 rounded-md p-2"
            onChange={handleChange}
          />
        </div>
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 "
          >
            Mô tả
          </label>
          <textarea
            type="description"
            name="description"
            placeholder="Descritption"
            rows="4"
            className="mt-1 p-2  w-full border border-gray-300 rounded-md block"
            onChange={handleChange}
          ></textarea>
        </div>
        <button
          type="submit"
          className="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 font-bold rounded"
        >
          Thêm cảm biến
        </button>
      </form>
    </div>
  );
}

export default Addsensor;