// src/lib/surahNameSvg.ts
export function surahNameSrc(n: number | string) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1 || num > 114) return "";
  return `/surah-names/Surah=sname_${num}.svg`;
}
