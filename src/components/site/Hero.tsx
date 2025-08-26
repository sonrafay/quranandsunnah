"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_50%_0%,hsl(var(--primary)/0.08),transparent)]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="pt-28 md:pt-36 min-h-[80vh] flex items-center justify-center">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl sm:text-6xl font-bold tracking-tight"
            >
              Quran &amp; Sunnah
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              One clean place for Quran, Hadith, and study tools — free for everyone.
            </motion.p>

            <div className="mt-10 flex items-center justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/quran">Open the App</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#about">Read our mission</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
