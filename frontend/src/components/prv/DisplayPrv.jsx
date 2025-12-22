import React, { useState } from 'react';

export default function PrvSystem() {
  
  return (
    <div className="relative w-full max-w-[800px] aspect-[16/9] mx-auto">
      <img
        src="/img/prv.png"
        alt="Water System"
        className="absolute top-0 left-0 w-full h-full object-cover"
      />
      {/* Trước van */}
      <div className="absolute top-[53%] left-[14%] flex flex-col items-center z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <span className="text-black font-semibold mb-0.5 sm:mb-1 max-[639px]:text-[10px]">
          Áp trước van
        </span>
        <div className="w-9 h-9 text-sm sm:w-14 sm:h-14 sm:text-lg bg-white text-black font-semibold rounded-full flex items-center justify-center border-2 border-gray-700">
          52.4
        </div>
      </div>

      {/* Áp Sau van */}
      <div className="absolute top-[52%] left-[61%] flex flex-col items-center z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <span className="text-black font-semibold mb-0.5 sm:mb-1 max-[639px]:text-[10px]">
          Áp sau van
        </span>
        <div className="w-9 h-9 text-sm sm:w-14 sm:h-14 sm:text-lg bg-white text-black font-semibold rounded-full flex items-center justify-center border-2 border-gray-700">
          {prressureA}
        </div>
      </div>
      {/* Sau van */}
      <div className="absolute top-[20%] left-[80%] flex flex-col items-center z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <span className="text-black font-semibold mb-0.5 sm:mb-1 max-[639px]:text-[10px]">
          Áp bất lợi
        </span>
        <div className="w-9 h-9 text-sm sm:w-14 sm:h-14 sm:text-lg bg-white text-black font-semibold rounded-full flex items-center justify-center border-2 border-gray-700">
          {prressureB}
        </div>
      </div>
      {/* Lưu lượng */}
      <div className="absolute top-[51%] left-[75%] flex flex-col items-center z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <span className="text-black font-semibold mb-0.5 sm:mb-1 max-[639px]:text-[10px]">
          Lưu lượng
        </span>
        <div className="w-9 h-9 text-sm sm:w-14 sm:h-14 sm:text-lg bg-white text-black font-semibold rounded-full flex items-center justify-center border-2 border-gray-700">
          117.2
        </div>
      </div>
    </div>
  );
}
