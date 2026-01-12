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
        {/* Mobile/Tablet: Responsive layout with smooth transition */}
        <div className="flex flex-col gap-2 md:hidden transition-all duration-300 ease-in-out">
          {/* Row 1: Brand + Right Controls */}
          <div className="flex items-center justify-between min-h-[40px]">
            <Link
              href={isApp ? "/quran" : "/#home"}
              className="rounded-full px-3 py-1 font-semibold tracking-tight hover:opacity-90 transition-all duration-300 ease-in-out text-[clamp(0.75rem,3vw,0.875rem)]"
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
                    className="rounded-full border bg-background/60 backdrop-blur p-2 hover:bg-muted transition-all duration-300 ease-in-out"
                    title="Search"
                  >
                    <Search className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/settings"
                    className="rounded-full border bg-background/60 backdrop-blur p-2 hover:bg-muted transition-all duration-300 ease-in-out"
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

          {/* Row 2: Navigation Menu - slides down smoothly */}
          {!isUtility && (
            <div className="flex items-center justify-center animate-slide-down">
              <NavigationMenu>
                <NavigationMenuList className="whitespace-nowrap bg-gradient-to-r from-foreground/5 via-foreground/10 to-foreground/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-foreground/10 transition-all duration-300 ease-in-out">
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
                            "flex items-center gap-1.5 text-xs transition-all duration-300 ease-in-out whitespace-nowrap",
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

        {/* Desktop: Absolute center for navigation - fixed height container */}
        <div className="hidden md:flex items-center justify-between relative w-full">
          {/* brand (left) */}
          <div className="flex items-center shrink-0 z-20">
            <Link
              href={isApp ? "/quran" : "/#home"}
              className="rounded-full px-3 py-1 font-semibold tracking-tight hover:opacity-90 transition-all duration-300 ease-in-out text-sm xl:text-base whitespace-nowrap"
              aria-label="Quran & Sunnah Home"
            >
              Quran &amp; Sunnah
            </Link>
          </div>

          {/* centered island - absolutely centered with higher z-index */}
          {!isUtility && (
            <div className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <NavigationMenu>
                <NavigationMenuList className="pointer-events-auto whitespace-nowrap bg-gradient-to-r from-foreground/5 via-foreground/10 to-foreground/5 backdrop-blur-md px-[clamp(0.75rem,1.5vw,1.25rem)] py-2 rounded-full border border-foreground/10 transition-all duration-300 ease-in-out">
                  {links.map(({ href, label, icon: Icon }) => {
                    const active =
                      pathname === href ||
                      pathname.startsWith(href + "/") ||
                      (href !== "/" && pathname.startsWith(href));
                    return (
                      <NavigationMenuItem key={href} className="px-[clamp(0.375rem,1vw,0.75rem)] transition-all duration-300 ease-in-out">
                        <NavigationMenuLink
                          href={href}
                          className={cn(
                            "flex items-center gap-[clamp(0.375rem,0.8vw,0.5rem)] text-[clamp(0.75rem,0.9vw,0.875rem)] transition-all duration-300 ease-in-out whitespace-nowrap",
                            active ? "text-foreground" : "text-foreground/80 hover:text-foreground"
                          )}
                        >
                          <Icon className="w-[clamp(0.875rem,1vw,1rem)] h-[clamp(0.875rem,1vw,1rem)] transition-all duration-300 ease-in-out" />
                          <span className="transition-all duration-300 ease-in-out">{label}</span>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    );
                  })}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          )}

          {/* right controls */}
          <div className="flex items-center justify-end gap-1.5 lg:gap-2 shrink-0 z-20">
            {isLanding ? (
              <Button asChild size="sm" className="font-normal text-xs lg:text-sm">
                <Link href="/quran">Open App</Link>
              </Button>
            ) : (
              <>
                <Link
                  href="/search"
                  className="group rounded-full border bg-background/60 backdrop-blur px-2 py-2 xl:px-3 xl:py-1.5 text-sm hover:bg-muted transition-all duration-300 ease-in-out flex items-center justify-center gap-0 xl:gap-2 font-normal overflow-hidden"
                  title="Search"
                >
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="w-0 xl:w-auto max-h-0 xl:max-h-10 opacity-0 xl:opacity-100 translate-y-[-4px] xl:translate-y-0 transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">Search</span>
                </Link>

                <Link
                  href="/settings"
                  className="group rounded-full border bg-background/60 backdrop-blur px-2 py-2 xl:px-3 xl:py-1.5 text-sm hover:bg-muted transition-all duration-300 ease-in-out flex items-center justify-center gap-0 xl:gap-2 font-normal overflow-hidden"
                  title="Settings"
                >
                  <Gear className="h-4 w-4 shrink-0" />
                  <span className="w-0 xl:w-auto max-h-0 xl:max-h-10 opacity-0 xl:opacity-100 translate-y-[-4px] xl:translate-y-0 transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">Settings</span>
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
