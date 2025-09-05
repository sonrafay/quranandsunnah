// src/app/recent/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getRecentReadings, removeRecentReading } from "@/lib/cloud";
import { Button } from "@/components/ui/button";
import { surahs } from "@/lib/quran-meta";
import AppSubnav from "@/components/AppSubnav";

type Row = {
  id: string;   // surah as string
  surah: number;
  ayah?: number | null;
  updatedAt?: { seconds: number; nanoseconds: number };
};

function timeAgo(sec?: number) {
  if (!sec) return "";
  const diff = Date.now() / 1000 - sec;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

export default function RecentReadingsPage() {
  const { user, loading, signInGoogle } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    (async () => {
      setFetching(true);
      try {
        const data = await getRecentReadings(user.uid, 5);
        setRows(data as Row[]);
      } finally {
        setFetching(false);
      }
    })();
  }, [user, loading]);

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-28">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-28 space-y-4 text-center">
        <AppSubnav />
        <h1 className="text-2xl font-bold">Recent readings</h1>
        <p className="text-muted-foreground">Sign in to continue where you left off.</p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={signInGoogle}>Continue with Google</Button>
          <Button variant="outline" onClick={() => router.push("/signin?next=/recent")}>
            Use email instead
          </Button>
        </div>
      </div>
    );
  }

  const content = useMemo(() => {
    if (fetching) return <div>Loading…</div>;
    if (!rows.length) return <div className="text-muted-foreground">No recent readings yet.</div>;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r) => {
          const meta = surahs.find((s) => s.number === r.surah);
          const title = meta
            ? `#${String(r.surah).padStart(3, "0")} • ${meta.englishName}`
            : `Surah ${r.surah}`;
          const ayah = r.ayah ?? 1;
          const link = `/quran/${r.surah}#ayah-${ayah}`;
          const updatedSec = r.updatedAt?.seconds;

          return (
            <div
              key={r.id}
              className="rounded-xl border p-4 bg-background/60 hover:bg-muted/40 transition"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm opacity-80">{title}</div>
                <div className="text-xs opacity-60">{timeAgo(updatedSec)}</div>
              </div>
              <div className="mt-1 font-medium">
                Continue at Ayah {r.surah}:{ayah}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Link href={link} className="text-sm underline underline-offset-4">
                  Open
                </Link>
                <button
                  onClick={() =>
                    removeRecentReading(user.uid, r.surah).then(() =>
                      setRows((prev) => prev.filter((x) => x.surah !== r.surah))
                    )
                  }
                  className="text-sm text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [rows, fetching, user]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-28">
      <AppSubnav />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recent readings</h1>
          <p className="text-muted-foreground">Pick up right where you left off.</p>
        </div>
      </div>

      <div className="mt-6">
        {content}
      </div>
    </div>
  );
}
