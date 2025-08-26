"use client";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { BookOpen, Home, Landmark, Clock, User, Settings as Gear, Search } from "lucide-react";
import { ModeToggle } from "./ModeToggle";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type LinkDef = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const landingLinks: LinkDef[] = [
  { href: "#home",    label: "Home",         icon: Home },
  { href: "#about",   label: "About",        icon: User },
  { href: "#work",    label: "Work with us", icon: Landmark },
  { href: "#faq",     label: "FAQs",         icon: BookOpen },
  { href: "#socials", label: "Socials",      icon: Landmark },
];

const appLinks: LinkDef[] = [
  { href: "/quran",  label: "Quran",  icon: BookOpen },
  { href: "/hadith", label: "Hadith", icon: Landmark },
  { href: "/prayer", label: "Prayer", icon: Clock },
];

export function Navigation() {
  const pathname = usePathname();
  const isApp =
    (pathname?.startsWith("/quran") ?? false) ||
    (pathname?.startsWith("/hadith") ?? false) ||
    (pathname?.startsWith("/prayer") ?? false);

  const links = isApp ? appLinks : landingLinks;

  return (
    <nav className="fixed w-full top-0 z-50 px-4 py-3">
      <div className="max-w-7xl mx-auto grid grid-cols-3 items-center">
        {/* brand */}
        <div className="flex items-center">
          <Link
            href={isApp ? "/quran" : "/#home"}
            className="rounded-full px-3 py-1 font-semibold tracking-tight hover:opacity-90 transition"
            aria-label="Quran & Sunnah Home"
          >
            Quran &amp; Sunnah
          </Link>
        </div>

        {/* centered island */}
        <div className="flex items-center justify-center">
          <NavigationMenu>
            <NavigationMenuList className="whitespace-nowrap bg-gradient-to-r from-foreground/5 via-foreground/10 to-foreground/5 backdrop-blur-md px-5 py-2 rounded-full border border-foreground/10">
              {links.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname?.startsWith(href + "/");
                return (
                  <NavigationMenuItem key={href} className="px-2 sm:px-3">
                    <NavigationMenuLink
                      href={href}
                      className={cn(
                        "flex items-center gap-2 text-sm transition-colors whitespace-nowrap",
                        active ? "text-foreground" : "text-foreground/80 hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* right controls */}
        <div className="flex items-center justify-end gap-2">
          {isApp ? (
            <>
              <Link
                href="/search"
                className="rounded-full border bg-background/60 backdrop-blur px-3 py-1.5 text-sm hover:bg-muted transition flex items-center gap-2"
                title="Search"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </Link>
              <Link
                href="/settings"
                className="rounded-full border bg-background/60 backdrop-blur px-3 py-1.5 text-sm hover:bg-muted transition flex items-center gap-2"
                title="Settings"
              >
                <Gear className="h-4 w-4" />
                <span>Settings</span>
              </Link>
              <Link
                href="/account"
                className="rounded-full border bg-background/60 backdrop-blur px-3 py-1.5 text-sm hover:bg-muted transition flex items-center gap-2"
                title="Account"
              >
                <User className="h-4 w-4" />
                <span>Account</span>
              </Link>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/quran">Open App</Link>
            </Button>
          )}
          <ModeToggle />
        </div>
      </div>
    </nav>
  );
}
