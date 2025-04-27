import React, { useState, useEffect } from "react";
import { getGroup, changeGroup, deleteGroup, addGroup } from "../../api";
import { useAuth } from '../../context/authContext'

export default function GroupNameTable() {
  const { user } = useAuth()
  const [data, setData] = useState([]);
  const [groups, setGroups] = useState([]);
  const [newGroup, setNewGroup] = useState("");

  const fetchGroups = async () => {
    try {
      const res = await getGroup(localStorage.getItem("token"), { user: user.user })
      setGroups(res.data.group)
      setData(res.data.sen_group)
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  }

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleGroupChange = async (index, newGroup, name) => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await changeGroup(localStorage.getItem("token"), { newGroup: newGroup, name: name, user: user.user })
      if (res.data.success) {
        const updatedData = data.map((item, i) =>
          i === index ? { ...item, group: newGroup } : item
        );
        setData(updatedData);
      }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  };

  const handleAddGroup = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    if (newGroup && !groups.includes(newGroup)) {
      try {
        const res = await addGroup(localStorage.getItem("token"), { newGroup: newGroup, user: user.user })
      } catch (error) {

      }
      setGroups([...groups, newGroup]);
      setNewGroup("");
    }
  };

  const handleRemoveGroup = async (groupToRemove) => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await deleteGroup(localStorage.getItem("token"), { groupToRemove: groupToRemove, user: user.user })
      if (res.data.success) {
        setGroups(groups.filter(group => group !== groupToRemove));
        setData(data.map(item => item.group === groupToRemove ? { ...item, group: "Không có" } : item));
      }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  };

  return (
    <div className="mt-5 flex flex-wrap justify-center gap-4 w-full">
      <div className="w-1/2">
        <table className="w-full border-collapse shadow-lg rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-blue-500 text-white">
              <th className="py-2 px-4 text-left">Tên</th>
              <th className="py-2 px-4 text-right">Nhóm</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <div className="flex justify-center items-center h-screen">
                <div>Loading...</div>
              </div>
            ) : (data.map((item, index) => (
              <tr key={index} className="border-b hover:bg-gray-100 transition duration-200">
                <td className="py-2 px-4 text-left text-gray-600">{item.name}</td>
                <td className="py-2 px-4 text-right font-semibold text-gray-700">
                  <select
                    className="border rounded px-2 py-1"
                    value={item.group}
                    onChange={(e) => handleGroupChange(index, e.target.value, item.name)}
                  >
                    {/* <option value="">Khong co</option> */}
                    {groups.map((group) => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <div className="w-1/2 p-4 border rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-3">Quản lý nhóm</h2>
        <div className="mb-3">
          <input
            type="text"
            className="border px-2 py-1 rounded w-full"
            placeholder="Tên nhóm mới"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
          />
          <button
            className="mt-2 bg-green-500 text-white px-3 py-1 rounded"
            onClick={handleAddGroup}
          >
            Thêm nhóm
          </button>
        </div>
        <ul>
          {groups
            .filter(group => group !== "Không có")
            .map(group => (
              <li key={group} className="flex justify-between items-center py-1">
                <span>{group}</span>
                <button
                  className="bg-red-500 text-white px-2 py-1 rounded"
                  onClick={() => handleRemoveGroup(group)}
                >
                  Xóa
                </button>
              </li>
            ))}

        </ul>
      </div>
    </div>
  );
}
