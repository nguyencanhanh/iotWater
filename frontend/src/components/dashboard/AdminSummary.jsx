import React, { useEffect, useState } from "react";
// import { dashboardSummaryGet } from "../../api/index";
import SummaryCard from "./SummaryCard";
import { FaBuilding, FaFileAlt, FaMoneyBillWave } from "react-icons/fa";
import { MdSensors } from "react-icons/md";


function AdminSummary() {
    const [summary, setSummary] = useState(null)
      
    return (
        <div className="p-6">
            <h3 className="text-2xl font-bold">Dashboard Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <SummaryCard
                    icon={<MdSensors />}
                    text="Total Sensor"
                    // number={summary.totalEmployees}
                    number={13}
                    color="bg-teal-600"
                />
                <SummaryCard
                    icon={<FaBuilding />}
                    text="Total Departments"
                    // number={summary.totalDepartment}
                    number={13}
                    color="bg-yellow-600"
                />
                <SummaryCard
                    icon={<FaMoneyBillWave />}
                    text="Monthly Sallary"
                    // number={summary.totalSallary}
                    number={13}
                    color="bg-red-600"
                />
            </div>
            <div className="mt-12">
                <h4 className="text-center text-2xl font-bold">Leave Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <SummaryCard
                        icon={<FaFileAlt />}
                        text="Leave Applied"
                        // number={summary.leaveSummary.appliedFor}
                        number={13}
                        color="bg-teal-600"
                    />
                    <SummaryCard
                        icon={<FaFileAlt />}
                        text="Leave Approved"
                        // number={summary.leaveSummary.approved}
                        number={13}
                        color="bg-green-600"
                    />
                    <SummaryCard
                        icon={<FaFileAlt />}
                        text="Leave Pending"
                        // number={summary.leaveSummary.pending}
                        number={13}
                        color="bg-yellow-600"
                    />
                    <SummaryCard
                        icon={<FaFileAlt />}
                        text="Leave Rejected"
                        // number={summary.leaveSummary.rejected}
                        number={13}
                        color="bg-red-600"
                    />
                </div>
            </div>
        </div>
    );
}

export default AdminSummary