"use client";

export default function LockedVerseCard() {
  return (
    <section className="rounded-xl glass-surface glass-readable p-5 space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Verse reflection</h2>
        <p className="text-sm text-muted-foreground">
          Coming soon. Choose a Quran verse to highlight once unlocked.
        </p>
      </header>

      <div className="rounded-lg glass-surface glass-readable p-4 text-sm">
        <div className="font-medium">Locked in V1</div>
        <div className="text-xs text-muted-foreground mt-1">
          Unlock requirement: 30-day streak. Verse selection will be Surah:Ayah only.
        </div>
      </div>
    </section>
  );
}
