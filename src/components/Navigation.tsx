"use client";

import * as React from "react";
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
import ProfileMenu from "@/components/ProfileMenu";

type LinkDef = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const landingLinks: LinkDef[] = [
  { href: "#home", label: "Home", icon: Home },
  { href: "#about", label: "About", icon: User },
  { href: "#work", label: "Work with us", icon: Landmark },
  { href: "#faq", label: "FAQs", icon: BookOpen },
  { href: "#socials", label: "Socials", icon: Landmark },
];

const appLinks: LinkDef[] = [
  { href: "/quran", label: "Quran", icon: BookOpen },
  { href: "/hadith", label: "Hadith", icon: Landmark },
  { href: "/prayer", label: "Prayer", icon: Clock },
];

/** Hide on scroll down, show on scroll up */
function useHideOnScroll() {
  const [hidden, setHidden] = React.useState(false);
  const lastY = React.useRef(0);

  React.useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const goingDown = y > lastY.current + 4;
      const goingUp = y < lastY.current - 4;
      // start hiding only after some offset
      if (y > 80 && goingDown) setHidden(true);
      else if (goingUp) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}

export function Navigation() {
  const pathname = usePathname() || "/";
  const isLanding = pathname === "/";
  const isApp =
    pathname.startsWith("/quran") ||
    pathname.startsWith("/hadith") ||
    pathname.startsWith("/prayer");
  const isUtility =
    pathname.startsWith("/search") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/bookmarks") ||
    pathname.startsWith("/notes") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/signin") ||
    pathname.startsWith("/recent");

  const links = isApp ? appLinks : landingLinks;
  const hidden = useHideOnScroll();

  return (
    <nav
      className={cn(
        "fixed w-full top-0 z-50 px-2 sm:px-4 py-2 sm:py-3 transition-transform duration-200",
        hidden ? "-translate-y-full" : "translate-y-0"
      )}
    >
      <div className="max-w-7xl mx-auto">
        {/* Mobile: Stack vertically */}
        <div className="flex flex-col gap-2 md:hidden">
          {/* Row 1: Brand + Right Controls */}
          <div className="flex items-center justify-between">
            <Link
              href={isApp ? "/quran" : "/#home"}
              className="rounded-full px-3 py-1 font-semibold tracking-tight hover:opacity-90 transition text-sm"
              aria-label="Quran & Sunnah Home"
            >
              Quran &amp; Sunnah
            </Link>
            <div className="flex items-center gap-1">
              {isLanding ? (
                <Button asChild size="sm" className="font-normal text-xs h-8">
                  <Link href="/quran">Open App</Link>
                </Button>
              ) : (
                <>
                  <Link
                    href="/search"
                    className="rounded-full border bg-background/60 backdrop-blur p-2 hover:bg-muted transition"
                    title="Search"
                  >
                    <Search className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/settings"
                    className="rounded-full border bg-background/60 backdrop-blur p-2 hover:bg-muted transition"
                    title="Settings"
                  >
                    <Gear className="h-4 w-4" />
                  </Link>

                  <ProfileMenu iconOnlyBelow="xl" />
                </>
              )}
              <ModeToggle />
            </div>
          </div>

          {/* Row 2: Navigation Menu */}
          {!isUtility && (
            <div className="flex items-center justify-center">
              <NavigationMenu>
                <NavigationMenuList className="whitespace-nowrap bg-gradient-to-r from-foreground/5 via-foreground/10 to-foreground/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-foreground/10">
                  {links.map(({ href, label, icon: Icon }) => {
                    const active =
                      pathname === href ||
                      pathname.startsWith(href + "/") ||
                      (href !== "/" && pathname.startsWith(href));
                    return (
                      <NavigationMenuItem key={href} className="px-1.5">
                        <NavigationMenuLink
                          href={href}
                          className={cn(
                            "flex items-center gap-1.5 text-xs transition-colors whitespace-nowrap",
                            active ? "text-foreground" : "text-foreground/80 hover:text-foreground"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    );
                  })}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          )}
        </div>

        {/* Desktop: Flexible grid that prevents overlap */}
        <div className="hidden md:grid grid-cols-[auto_1fr_auto] items-center gap-4">
          {/* brand (left) */}
          <div className="flex items-center shrink-0">
            <Link
              href={isApp ? "/quran" : "/#home"}
              className="rounded-full px-3 py-1 font-semibold tracking-tight hover:opacity-90 transition text-sm xl:text-base whitespace-nowrap"
              aria-label="Quran & Sunnah Home"
            >
              Quran &amp; Sunnah
            </Link>
          </div>

          {/* centered island (hidden on utility pages) */}
          <div className="flex items-center justify-center min-w-0">
            {!isUtility && (
              <NavigationMenu>
                <NavigationMenuList className="whitespace-nowrap bg-gradient-to-r from-foreground/5 via-foreground/10 to-foreground/5 backdrop-blur-md px-3 lg:px-4 xl:px-5 py-2 rounded-full border border-foreground/10">
                  {links.map(({ href, label, icon: Icon }) => {
                    const active =
                      pathname === href ||
                      pathname.startsWith(href + "/") ||
                      (href !== "/" && pathname.startsWith(href));
                    return (
                      <NavigationMenuItem key={href} className="px-1.5 lg:px-2 xl:px-3">
                        <NavigationMenuLink
                          href={href}
                          className={cn(
                            "flex items-center gap-1.5 lg:gap-2 text-xs lg:text-sm transition-colors whitespace-nowrap",
                            active ? "text-foreground" : "text-foreground/80 hover:text-foreground"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                          <span>{label}</span>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    );
                  })}
                </NavigationMenuList>
              </NavigationMenu>
            )}
          </div>

          {/* right controls */}
          <div className="flex items-center justify-end gap-1.5 lg:gap-2 shrink-0">
            {isLanding ? (
              <Button asChild size="sm" className="font-normal text-xs lg:text-sm">
                <Link href="/quran">Open App</Link>
              </Button>
            ) : (
              <>
                <Link
                  href="/search"
                  className="rounded-full border bg-background/60 backdrop-blur p-2 xl:px-3 xl:py-1.5 text-sm hover:bg-muted transition flex items-center gap-2 font-normal"
                  title="Search"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden xl:inline">Search</span>
                </Link>

                <Link
                  href="/settings"
                  className="rounded-full border bg-background/60 backdrop-blur p-2 xl:px-3 xl:py-1.5 text-sm hover:bg-muted transition flex items-center gap-2 font-normal"
                  title="Settings"
                >
                  <Gear className="h-4 w-4" />
                  <span className="hidden xl:inline">Settings</span>
                </Link>

                {/* Profile dropdown (auth-gated actions inside) */}
                <ProfileMenu iconOnlyBelow="xl" />
              </>
            )}
            <ModeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
