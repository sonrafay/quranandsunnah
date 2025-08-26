export default function AmbientGlow() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* faint base radial tint */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_0%,hsl(var(--primary)/0.06),transparent)]" />

      {/* top-left emerald */}
      <div
        className="absolute -top-24 -left-24 h-[38rem] w-[38rem] rounded-full blur-[140px]
                   bg-emerald-500/30 mix-blend-screen dark:mix-blend-screen"
      />
      {/* top-right cyan */}
      <div
        className="absolute -top-32 right-0 h-[32rem] w-[32rem] rounded-full blur-[140px]
                   bg-cyan-500/28 mix-blend-screen dark:mix-blend-screen"
      />
      {/* bottom-center sky */}
      <div
        className="absolute bottom-[-10rem] left-1/3 h-[42rem] w-[42rem] rounded-full blur-[160px]
                   bg-sky-500/20 mix-blend-screen dark:mix-blend-screen"
      />
    </div>
  );
}
