"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { deleteQuranNote, saveQuranNote } from "@/lib/cloud";
import { getApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import AppSubnav from "@/components/AppSubnav";

type QuranNote = {
  scope: "quran";
  keyRef: string; // `${surah}:${ayah}`
  surah: number;
  ayah: number;
  content: string;
  updatedAt?: { seconds: number; nanoseconds?: number };
};

export default function NotesPage() {
  const { user, loading, signInGoogle } = useAuth();
  const [notes, setNotes] = useState<QuranNote[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "surah">("newest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!user) return;
    const db = getFirestore(getApp());
    const col = collection(db, "users", user.uid, "notes");
    const q = query(col, orderBy("updatedAt", "desc"));
    const off = onSnapshot(q, (snap) => {
      const out: QuranNote[] = [];
      snap.forEach((d) => {
        const v = d.data() as QuranNote;
        if (v.scope === "quran") out.push(v);
      });
      setNotes(out);
    });
    return () => off();
  }, [user]);

  const sorted = useMemo(() => {
    const arr = [...notes];
    switch (sortBy) {
      case "newest": arr.sort((a,b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0)); break;
      case "oldest": arr.sort((a,b) => (a.updatedAt?.seconds ?? 0) - (b.updatedAt?.seconds ?? 0)); break;
      case "surah":  arr.sort((a,b) => a.surah - b.surah || a.ayah - b.ayah); break;
    }
    return arr;
  }, [notes, sortBy]);

  const onDelete = async (n: QuranNote) => {
    if (!user) return;
    const ok = confirm(`Delete note for Surah ${n.surah}, Ayah ${n.ayah}?`);
    if (!ok) return;
    await deleteQuranNote(user.uid, n.surah, n.ayah);
    window.dispatchEvent(new CustomEvent("qs-note-deleted", { detail: { surah: n.surah, ayah: n.ayah } }));
    if (editingId === n.keyRef) { setEditingId(null); setDraft(""); }
  };

  const startEdit = (n: QuranNote) => { setEditingId(n.keyRef); setDraft(n.content); };
  const cancelEdit = () => { setEditingId(null); setDraft(""); };
  const saveEdit = async (n: QuranNote) => {
    if (!user) return;
    const trimmed = draft.trim();
    if (!trimmed) { await onDelete(n); return; }
    await saveQuranNote(user.uid, n.surah, n.ayah, trimmed);
    setEditingId(null); setDraft("");
  };

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12 space-y-4 text-center">
        <AppSubnav />
        <h1 className="text-2xl font-bold">Notes</h1>
        <p className="text-muted-foreground">Sign in to view and manage your reflections.</p>
        <button
          onClick={signInGoogle}
          className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm text-background"
        >
          Continue with Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12">
      <AppSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="text-muted-foreground">Your saved reflections by surah & ayah.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm opacity-80">Sort</label>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="surah">Surah</option>
          </select>
        </div>
      </div>

      <div className="mt-6">
        {!sorted.length ? (
          <div className="text-muted-foreground">No notes yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((n) => {
              const link = `/quran/${n.surah}#ayah-${n.ayah}`;
              const isEditing = editingId === n.keyRef;
              return (
                <div
                  key={n.keyRef}
                  className="rounded-xl border p-4 bg-background/60 hover:bg-muted/40 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm opacity-80">
                      {`#${String(n.surah).padStart(3, "0")} • Surah ${n.surah}`}
                    </div>
                  </div>
                  <div className="mt-1 font-medium">Ayah {n.surah}:{n.ayah}</div>

                  {!isEditing ? (
                    <p className="mt-3 text-sm whitespace-pre-wrap line-clamp-6">{n.content}</p>
                  ) : (
                    <textarea
                      className="mt-3 w-full h-28 resize-none rounded-lg border border-black/10 dark:border-white/10 bg-transparent p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    {!isEditing ? (
                      <>
                        <Link href={link} className="text-sm underline underline-offset-4">
                          Open
                        </Link>
                        <button
                          onClick={() => startEdit(n)}
                          className="text-sm hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(n)}
                          className="text-sm text-destructive hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => saveEdit(n)}
                          className="text-sm px-2 py-1 rounded bg-indigo-600 text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-sm px-2 py-1 rounded border border-black/10 dark:border-white/10"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
