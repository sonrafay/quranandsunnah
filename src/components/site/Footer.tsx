// =============================
// FILE: components/site/Footer.tsx
import Link from "next/link";
import { Instagram, Youtube, MessageSquare, Github } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Quran and Sunnah. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="https://www.instagram.com/thequranandsunnah1/" target="_blank" aria-label="Instagram" className="opacity-80 hover:opacity-100"><Instagram className="h-5 w-5"/></Link>
            <Link href="https://www.tiktok.com/@thequranandsunnah.com" target="_blank" aria-label="TikTok" className="opacity-80 hover:opacity-100"><MessageSquare className="h-5 w-5"/></Link>
            <Link href="https://www.youtube.com/@theQuranandSunnah1" target="_blank" aria-label="YouTube" className="opacity-80 hover:opacity-100"><Youtube className="h-5 w-5"/></Link>
            <Link href="https://discord.gg/WKtX3BrZ" target="_blank" aria-label="Discord" className="opacity-80 hover:opacity-100"><MessageSquare className="h-5 w-5"/></Link>
            <Link href="https://github.com/" target="_blank" aria-label="GitHub" className="opacity-80 hover:opacity-100"><Github className="h-5 w-5"/></Link>
          </div>
        </div>
      </div>
    </footer>
  );
}