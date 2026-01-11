// src/components/AppSubnav.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, BookOpen, Library, Clock } from "lucide-react";

export default function AppSubnav({
  showBack = true,
}: {
  showBack?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const is = (rx: RegExp) => rx.test(pathname || "");

  const goBack = () => {
    // If there's real history, go back; otherwise land on the main Qur'an index
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/quran");
    }
  };

  const pillBase =
    "inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm transition";
  const active = "bg-foreground text-background";
  const idle = "text-foreground/80 hover:bg-foreground/10";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
      {/* Left: Back (hidden on mobile, shown on desktop) */}
      <div className="hidden sm:block sm:min-w-[80px]">
        {showBack && (
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-sm hover:bg-foreground/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
      </div>

      {/* Center: Qur'an / Hadith / Prayer pills */}
      <div className="flex-1 flex items-center justify-center w-full sm:w-auto">
        <div className="inline-flex items-center gap-0.5 sm:gap-1 rounded-full border bg-background/60 px-1 py-1 shadow-sm">
          <Link
            href="/quran"
            className={cn(pillBase, is(/^\/quran(\/|$)/) ? active : idle)}
          >
            <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline sm:inline">Qur'an</span>
          </Link>
          <Link
            href="/hadith"
            className={cn(pillBase, is(/^\/hadith(\/|$)/) ? active : idle)}
          >
            <Library className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline sm:inline">Hadith</span>
          </Link>
          <Link
            href="/prayer"
            className={cn(pillBase, is(/^\/prayer(\/|$)/) ? active : idle)}
          >
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline sm:inline">Prayer</span>
          </Link>
        </div>
      </div>

      {/* Mobile: Back button shown below on mobile */}
      {showBack && (
        <div className="sm:hidden w-full flex justify-center">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-xs hover:bg-foreground/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        </div>
      )}

      {/* Right spacer, keeps center truly centered on desktop */}
      <div className="hidden sm:block sm:min-w-[80px]" />
    </div>
  );
}
