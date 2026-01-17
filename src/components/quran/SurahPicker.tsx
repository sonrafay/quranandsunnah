"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

// All 114 Surahs
const SURAHS = [
  { id: 1, name: "Al-Fatihah", arabic: "الفاتحة" },
  { id: 2, name: "Al-Baqarah", arabic: "البقرة" },
  { id: 3, name: "Ali 'Imran", arabic: "آل عمران" },
  { id: 4, name: "An-Nisa", arabic: "النساء" },
  { id: 5, name: "Al-Ma'idah", arabic: "المائدة" },
  { id: 6, name: "Al-An'am", arabic: "الأنعام" },
  { id: 7, name: "Al-A'raf", arabic: "الأعراف" },
  { id: 8, name: "Al-Anfal", arabic: "الأنفال" },
  { id: 9, name: "At-Tawbah", arabic: "التوبة" },
  { id: 10, name: "Yunus", arabic: "يونس" },
  { id: 11, name: "Hud", arabic: "هود" },
  { id: 12, name: "Yusuf", arabic: "يوسف" },
  { id: 13, name: "Ar-Ra'd", arabic: "الرعد" },
  { id: 14, name: "Ibrahim", arabic: "إبراهيم" },
  { id: 15, name: "Al-Hijr", arabic: "الحجر" },
  { id: 16, name: "An-Nahl", arabic: "النحل" },
  { id: 17, name: "Al-Isra", arabic: "الإسراء" },
  { id: 18, name: "Al-Kahf", arabic: "الكهف" },
  { id: 19, name: "Maryam", arabic: "مريم" },
  { id: 20, name: "Taha", arabic: "طه" },
  { id: 21, name: "Al-Anbya", arabic: "الأنبياء" },
  { id: 22, name: "Al-Hajj", arabic: "الحج" },
  { id: 23, name: "Al-Mu'minun", arabic: "المؤمنون" },
  { id: 24, name: "An-Nur", arabic: "النور" },
  { id: 25, name: "Al-Furqan", arabic: "الفرقان" },
  { id: 26, name: "Ash-Shu'ara", arabic: "الشعراء" },
  { id: 27, name: "An-Naml", arabic: "النمل" },
  { id: 28, name: "Al-Qasas", arabic: "القصص" },
  { id: 29, name: "Al-'Ankabut", arabic: "العنكبوت" },
  { id: 30, name: "Ar-Rum", arabic: "الروم" },
  { id: 31, name: "Luqman", arabic: "لقمان" },
  { id: 32, name: "As-Sajdah", arabic: "السجدة" },
  { id: 33, name: "Al-Ahzab", arabic: "الأحزاب" },
  { id: 34, name: "Saba", arabic: "سبأ" },
  { id: 35, name: "Fatir", arabic: "فاطر" },
  { id: 36, name: "Ya-Sin", arabic: "يس" },
  { id: 37, name: "As-Saffat", arabic: "الصافات" },
  { id: 38, name: "Sad", arabic: "ص" },
  { id: 39, name: "Az-Zumar", arabic: "الزمر" },
  { id: 40, name: "Ghafir", arabic: "غافر" },
  { id: 41, name: "Fussilat", arabic: "فصلت" },
  { id: 42, name: "Ash-Shura", arabic: "الشورى" },
  { id: 43, name: "Az-Zukhruf", arabic: "الزخرف" },
  { id: 44, name: "Ad-Dukhan", arabic: "الدخان" },
  { id: 45, name: "Al-Jathiyah", arabic: "الجاثية" },
  { id: 46, name: "Al-Ahqaf", arabic: "الأحقاف" },
  { id: 47, name: "Muhammad", arabic: "محمد" },
  { id: 48, name: "Al-Fath", arabic: "الفتح" },
  { id: 49, name: "Al-Hujurat", arabic: "الحجرات" },
  { id: 50, name: "Qaf", arabic: "ق" },
  { id: 51, name: "Adh-Dhariyat", arabic: "الذاريات" },
  { id: 52, name: "At-Tur", arabic: "الطور" },
  { id: 53, name: "An-Najm", arabic: "النجم" },
  { id: 54, name: "Al-Qamar", arabic: "القمر" },
  { id: 55, name: "Ar-Rahman", arabic: "الرحمن" },
  { id: 56, name: "Al-Waqi'ah", arabic: "الواقعة" },
  { id: 57, name: "Al-Hadid", arabic: "الحديد" },
  { id: 58, name: "Al-Mujadila", arabic: "المجادلة" },
  { id: 59, name: "Al-Hashr", arabic: "الحشر" },
  { id: 60, name: "Al-Mumtahanah", arabic: "الممتحنة" },
  { id: 61, name: "As-Saf", arabic: "الصف" },
  { id: 62, name: "Al-Jumu'ah", arabic: "الجمعة" },
  { id: 63, name: "Al-Munafiqun", arabic: "المنافقون" },
  { id: 64, name: "At-Taghabun", arabic: "التغابن" },
  { id: 65, name: "At-Talaq", arabic: "الطلاق" },
  { id: 66, name: "At-Tahrim", arabic: "التحريم" },
  { id: 67, name: "Al-Mulk", arabic: "الملك" },
  { id: 68, name: "Al-Qalam", arabic: "القلم" },
  { id: 69, name: "Al-Haqqah", arabic: "الحاقة" },
  { id: 70, name: "Al-Ma'arij", arabic: "المعارج" },
  { id: 71, name: "Nuh", arabic: "نوح" },
  { id: 72, name: "Al-Jinn", arabic: "الجن" },
  { id: 73, name: "Al-Muzzammil", arabic: "المزمل" },
  { id: 74, name: "Al-Muddaththir", arabic: "المدثر" },
  { id: 75, name: "Al-Qiyamah", arabic: "القيامة" },
  { id: 76, name: "Al-Insan", arabic: "الإنسان" },
  { id: 77, name: "Al-Mursalat", arabic: "المرسلات" },
  { id: 78, name: "An-Naba", arabic: "النبأ" },
  { id: 79, name: "An-Nazi'at", arabic: "النازعات" },
  { id: 80, name: "'Abasa", arabic: "عبس" },
  { id: 81, name: "At-Takwir", arabic: "التكوير" },
  { id: 82, name: "Al-Infitar", arabic: "الانفطار" },
  { id: 83, name: "Al-Mutaffifin", arabic: "المطففين" },
  { id: 84, name: "Al-Inshiqaq", arabic: "الانشقاق" },
  { id: 85, name: "Al-Buruj", arabic: "البروج" },
  { id: 86, name: "At-Tariq", arabic: "الطارق" },
  { id: 87, name: "Al-A'la", arabic: "الأعلى" },
  { id: 88, name: "Al-Ghashiyah", arabic: "الغاشية" },
  { id: 89, name: "Al-Fajr", arabic: "الفجر" },
  { id: 90, name: "Al-Balad", arabic: "البلد" },
  { id: 91, name: "Ash-Shams", arabic: "الشمس" },
  { id: 92, name: "Al-Layl", arabic: "الليل" },
  { id: 93, name: "Ad-Duhaa", arabic: "الضحى" },
  { id: 94, name: "Ash-Sharh", arabic: "الشرح" },
  { id: 95, name: "At-Tin", arabic: "التين" },
  { id: 96, name: "Al-'Alaq", arabic: "العلق" },
  { id: 97, name: "Al-Qadr", arabic: "القدر" },
  { id: 98, name: "Al-Bayyinah", arabic: "البينة" },
  { id: 99, name: "Az-Zalzalah", arabic: "الزلزلة" },
  { id: 100, name: "Al-'Adiyat", arabic: "العاديات" },
  { id: 101, name: "Al-Qari'ah", arabic: "القارعة" },
  { id: 102, name: "At-Takathur", arabic: "التكاثر" },
  { id: 103, name: "Al-'Asr", arabic: "العصر" },
  { id: 104, name: "Al-Humazah", arabic: "الهمزة" },
  { id: 105, name: "Al-Fil", arabic: "الفيل" },
  { id: 106, name: "Quraysh", arabic: "قريش" },
  { id: 107, name: "Al-Ma'un", arabic: "الماعون" },
  { id: 108, name: "Al-Kawthar", arabic: "الكوثر" },
  { id: 109, name: "Al-Kafirun", arabic: "الكافرون" },
  { id: 110, name: "An-Nasr", arabic: "النصر" },
  { id: 111, name: "Al-Masad", arabic: "المسد" },
  { id: 112, name: "Al-Ikhlas", arabic: "الإخلاص" },
  { id: 113, name: "Al-Falaq", arabic: "الفلق" },
  { id: 114, name: "An-Nas", arabic: "الناس" },
];

export default function SurahPicker({ currentSurah }: { currentSurah: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const currentSurahData = SURAHS.find((s) => s.id === currentSurah);

  const filteredSurahs = useMemo(() => {
    if (!searchTerm) return SURAHS;
    const q = searchTerm.toLowerCase();
    return SURAHS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.arabic.includes(searchTerm) ||
        String(s.id).includes(q)
    );
  }, [searchTerm]);

  function navigateToSurah(surahId: number) {
    // Preserve query params when navigating
    const params = new URLSearchParams(searchParams.toString());
    router.push(`/quran/${surahId}?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "group flex items-center gap-2 h-10 px-4 rounded-xl",
          "glass-surface glass-readable",
          "text-sm font-medium transition-all duration-200",
          "hover:brightness-[0.92] dark:hover:brightness-[0.85]",
          open && "brightness-[0.92] dark:brightness-[0.85]"
        )}
      >
        <span className={cn(
          "transition-all duration-200",
          "group-hover:text-green-600 dark:group-hover:text-green-400",
          "group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
        )}>
          {currentSurah}. {currentSurahData?.name || `Surah ${currentSurah}`}
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform duration-200",
          open && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Dropdown panel */}
          <div className="absolute left-0 z-40 mt-2 w-[280px] rounded-xl glass-surface glass-readable p-3">
            {/* Search */}
            <div className="mb-2">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search surah..."
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                autoFocus
              />
            </div>

            {/* Surah list */}
            <div className="max-h-72 overflow-auto pr-1 space-y-0.5">
              {filteredSurahs.map((surah) => (
                <button
                  key={surah.id}
                  onClick={() => navigateToSurah(surah.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm",
                    "transition-all duration-150",
                    surah.id === currentSurah
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : "hover:bg-muted/50 hover:text-green-600 dark:hover:text-green-400"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-7 text-muted-foreground text-xs">{surah.id}.</span>
                    <span>{surah.name}</span>
                  </span>
                  <span className="text-muted-foreground/70 font-arabic text-base">
                    {surah.arabic}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
