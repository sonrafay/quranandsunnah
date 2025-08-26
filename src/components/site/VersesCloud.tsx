"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import verses from "@/lib/verses";

type Slot = { xPct: number; yPct: number };

// Wide, spaced slots (fits ~9–11 items nicely)
const SLOTS: Slot[] = [
  { xPct: 14, yPct: 20 }, { xPct: 38, yPct: 16 }, { xPct: 62, yPct: 18 }, { xPct: 82, yPct: 22 },
  { xPct: 22, yPct: 48 }, { xPct: 46, yPct: 44 }, { xPct: 70, yPct: 46 },
  { xPct: 18, yPct: 74 }, { xPct: 44, yPct: 70 }, { xPct: 72, yPct: 74 },
];

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function VersesCloud() {
  const [open, setOpen] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // deterministic placement with linear-probe collision resolution
  const placements = useMemo(() => {
    const used = new Set<number>();
    const pickSlot = (key: string) => {
      const total = SLOTS.length;
      let idx = hashString(key) % total;
      for (let tries = 0; tries < total; tries++) {
        const probe = (idx + tries) % total;
        if (!used.has(probe)) {
          used.add(probe);
          return probe;
        }
      }
      return 0;
    };
    const items = verses.slice(0, SLOTS.length);
    return items.map((v) => {
      const key = (v.ref ?? v.ar).toString();
      const slotIndex = pickSlot(key);
      return { v, slotIndex };
    });
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto max-w-6xl h-[56vh] md:h-[62vh] px-4 sm:px-6 lg:px-8 select-none"
    >
      {/* soft canvas tint so glow + cards sit nicely */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_35%_at_50%_10%,hsl(var(--muted-foreground)/0.08),transparent)]" />

      <div className="relative w-full h-full">
        {placements.map(({ v, slotIndex }, i) => {
          const slot = SLOTS[slotIndex];
          const isOpen = open === i;

          // Center transform when open, else position by slot
          const baseLeft = `${slot.xPct}%`;
          const baseTop = `${slot.yPct}%`;
          const toCenter = isOpen
            ? { left: "50%", top: "50%", translateX: "-50%", translateY: "-50%" }
            : { left: baseLeft, top: baseTop };

          // Pond drift for non-selected when open (push away from center)
          let driftX = 0, driftY = 0;
          if (open !== null && !isOpen) {
            const cx = 50, cy = 50;
            const dx = slot.xPct - cx;
            const dy = slot.yPct - cy;
            const mag = Math.max(Math.hypot(dx, dy), 1);
            const scale = 140; // px drift distance
            driftX = (dx / mag) * scale;
            driftY = (dy / mag) * scale;
          }

          // Per-card bobbing params (slight variation by index)
          const ampX = isOpen ? 3 : 8; // px
          const ampY = isOpen ? 2 : 6; // px
          const dur = 8 + (i % 3) * 1.5; // seconds
          const delay = (i % 5) * 0.25; // desync phase

          return (
            <motion.div
              key={i}
              className={`absolute ${isOpen ? "z-20" : "z-10"}`}
              style={toCenter as any}
              animate={{
                opacity: open === null ? 1 : isOpen ? 1 : 0.55,
                scale: open === null ? 1 : isOpen ? 1.02 : 0.92,
                translateX: isOpen ? "-50%" : undefined,
                translateY: isOpen ? "-50%" : undefined,
                x: open !== null && !isOpen ? driftX : 0,
                y: open !== null && !isOpen ? driftY : 0,
              }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              {/* Inner bobbing layer so they still “float” while pond effect runs on the wrapper */}
              <motion.div
                animate={{
                  x: [-ampX, 0, ampX, 0, -ampX],
                  y: [-ampY, 0, ampY, 0, -ampY],
                }}
                transition={{
                  duration: dur,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay,
                }}
              >
                <motion.button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="rounded-xl border bg-card/70 backdrop-blur-sm shadow-sm text-left cursor-pointer max-w-[18rem] sm:max-w-[19rem]"
                  layout
                  transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  aria-expanded={isOpen}
                >
                  <div className="px-4 py-3">
                    <div className="font-semibold tracking-tight leading-[1.9] text-base md:text-lg" dir="rtl">
                      {v.ar}
                    </div>
                    {isOpen && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <div dir="ltr">{v.en}</div>
                        <div className="mt-1 text-xs opacity-70">{v.ref}</div>
                      </div>
                    )}
                  </div>
                </motion.button>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
