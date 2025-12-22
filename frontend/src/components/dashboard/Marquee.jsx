import { useEffect, useRef, useState } from 'react';

export default function MarqueeTwice() {
  const [visible, setVisible] = useState(true);
  const marqueeRef = useRef(null);

  useEffect(() => {
    const el = marqueeRef.current;
    if (!el) return;

    const handleAnimationEnd = () => setVisible(false);
    el.addEventListener('animationend', handleAnimationEnd);
    return () => el.removeEventListener('animationend', handleAnimationEnd);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black py-2 px-4 z-50 overflow-hidden">
      {/* <div className="relative w-full h-8 overflow-hidden">
        <div
          ref={marqueeRef}
          className="absolute top-0 left-0 whitespace-nowrap animate-marquee-twice min-w-[1000px]"
        >
          🚀 Đây là thông báo chạy từ phải qua trái đúng 2 vòng rồi biến mất!
        </div>
      </div> */}
    </div>
  );
}
