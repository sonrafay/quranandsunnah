"use client";

import { useEffect, useState } from "react";

export default function ScrollProgressBar({
  height = 2,
}: {
  height?: number;
}) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(100, Math.max(0, (y / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[60] bg-white/10"
      style={{ height }}
      aria-hidden
    >
      <div
        className="h-full bg-white transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
