"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowUp } from "lucide-react";

export default function SurahFooterNav({ current }: { current: number }) {
  const prev = current > 1 ? current - 1 : null;
  const next = current < 114 ? current + 1 : null;

  return (
    <div className="mt-10 flex items-center justify-center gap-3">
      {prev ? (
        <Button asChild variant="outline">
          <Link href={`/quran/${prev}`}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
      )}

      <Button
        variant="outline"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp className="h-4 w-4 mr-1" />
        Top of Surah
      </Button>

      {next ? (
        <Button asChild variant="outline">
          <Link href={`/quran/${next}`}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}
