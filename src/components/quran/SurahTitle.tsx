"use client";

import Image from "next/image";
import { useState } from "react";

export default function SurahTitle({
  id,
  arabicName,
  englishNick,
}: {
  id: number;
  arabicName: string;
  englishNick?: string;
}) {
  const [imgOk, setImgOk] = useState(true);
  const src = `/calligraphy/${String(id).padStart(3, "0")}.svg`;

  return (
    <div className="mb-6">
      {/* Centered “pill” area; vertically & horizontally centered */}
      <div className="h-24 md:h-28 w-full flex items-center justify-center">
        <div className="inline-flex items-center justify-center rounded-md bg-teal-600 px-4 py-2 shadow-sm">
          {imgOk ? (
            <Image
              src={src}
              alt={arabicName}
              width={220}
              height={64}
              priority
              onError={() => setImgOk(false)}
            />
          ) : (
            <span className="font-quran text-2xl md:text-3xl text-white">{arabicName}</span>
          )}
        </div>
      </div>

      {englishNick && (
        <div className="text-right text-sm md:text-base text-muted-foreground">
          {englishNick}
        </div>
      )}
    </div>
  );
}
