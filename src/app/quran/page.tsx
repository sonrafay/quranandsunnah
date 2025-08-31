import type { Metadata } from "next";
import QuranIndexClient from "./QuranIndexClient";

export const metadata: Metadata = { title: "Quran" };

export default function QuranPage() {
  return <QuranIndexClient />;
}
