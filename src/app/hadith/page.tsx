import type { Metadata } from "next";
import HadithIndexClient from "./HadithIndexClient";

export const metadata: Metadata = { title: "Hadith" };

export default function HadithPage() {
  return <HadithIndexClient />;
}
