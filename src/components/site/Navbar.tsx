// =============================
// FILE: components/site/Navbar.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Work with us", href: "#work" },
  { label: "FAQs", href: "#faq" },
  { label: "Socials", href: "#socials" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="#home" className="font-semibold tracking-tight text-xl">
          Quran & Sunnah
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          {nav.map((i) => (
            <Link key={i.href} href={i.href} className="text-sm hover:opacity-80">
              {i.label}
            </Link>
          ))}
          <Button asChild size="sm">
            <Link href="#subscribe">Join the list</Link>
          </Button>
        </nav>
        <button
          aria-label="Open menu"
          className="md:hidden p-2"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
      {/* Mobile */}
      {open && (
        <div className="md:hidden border-t bg-background">
          <div className="mx-auto max-w-7xl px-4 py-2 flex justify-end">
            <button aria-label="Close menu" className="p-2" onClick={() => setOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="mx-auto max-w-7xl px-4 pb-6 space-y-3">
            {nav.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                className="block text-base"
              >
                {i.label}
              </Link>
            ))}
            <Button asChild size="sm" className="mt-2">
              <Link href="#subscribe" onClick={() => setOpen(false)}>
                Join the list
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}


