// import React, { useState } from "react";

// const AdjusterPressure = ({ onSend }) => {
//     const [duration, setDuration] = useState(localStorage.getItem('tCtr') || 3); 

//     const increase = () => {
//         setDuration((prev) => {
//             const newVal = Math.min(prev + 1, 999);
//             localStorage.setItem('tCtr', newVal);
//             return newVal;
//         });
//     };

//     const decrease = () => {
//         setDuration((prev) => {
//             const newVal = Math.max(prev - 1, 1);
//             localStorage.setItem('tCtr', newVal);
//             return newVal;
//         });
//     };

//     const sendCommand = (cmd) => {
//         if (onSend && cmd) {
//             onSend(cmd);
//         }
//     };

//     return (
        // <div className="flex flex-col items-center gap-3 p-4">
        //     <h3 className="text-lg font-bold">Điều chỉnh van thủ công</h3>

        //     <div className="flex flex-wrap justify-center gap-4">
        //         {/* Nút MỞ và ĐÓNG */}
        //         <button
        //             onClick={() => sendCommand(`1 ${duration * 10}`)}
        //             className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
        //         >
        //             MỞ VAN
        //         </button>
        //         <button
        //             onClick={() => sendCommand(`2 ${duration * 10}`)}
        //             className="bg-red-500 hover:bg-yellow-600 text-white font-semibold px-4 py-2 rounded"
        //         >
        //             ĐÓNG VAN
        //         </button>

        //         {/* Cụm nút điều chỉnh thời gian */}
        //         <div className="flex items-center gap-2">
        //             <button
        //                 onClick={decrease}
        //                 className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded"
        //             >
        //                 -
        //             </button>

        //             <span className="text-xl font-bold w-16 text-center">
        //                 {duration}s
        //             </span>

        //             <button
        //                 onClick={increase}
        //                 className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded"
        //             >
        //                 +
        //             </button>
        //         </div>
        //     </div>
        // </div>

//     );
// };

// export default AdjusterPressure;
