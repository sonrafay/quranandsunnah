"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Bookmark,
  StickyNote,
  Clock3,
  Bell,
  LogOut,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

export default function ProfileMenu({ iconOnlyBelow }: { iconOnlyBelow?: "sm" | "md" | "lg" | "xl" }) {
  const router = useRouter();
  const { user, loading, logOut } = useAuth();

  const [open, setOpen] = React.useState(false);

  function goOrSignIn(path: string) {
    if (!user) {
      router.push(`/signin?next=${encodeURIComponent(path)}`);
    } else {
      router.push(path);
    }
  }

  // Determine smooth transition classes based on breakpoint
  const labelTransitionClass = iconOnlyBelow === "xl" ? "w-0 xl:w-auto max-h-0 xl:max-h-10 opacity-0 xl:opacity-100 translate-y-[-4px] xl:translate-y-0" :
                                iconOnlyBelow === "lg" ? "w-0 lg:w-auto max-h-0 lg:max-h-10 opacity-0 lg:opacity-100 translate-y-[-4px] lg:translate-y-0" :
                                iconOnlyBelow === "md" ? "w-0 md:w-auto max-h-0 md:max-h-10 opacity-0 md:opacity-100 translate-y-[-4px] md:translate-y-0" :
                                iconOnlyBelow === "sm" ? "w-0 sm:w-auto max-h-0 sm:max-h-10 opacity-0 sm:opacity-100 translate-y-[-4px] sm:translate-y-0" : "";

  // Icon-only mode uses padding, full mode uses px-3 py-1.5
  const triggerClass = cn(
    "glass-surface glass-interactive rounded-full",
    iconOnlyBelow ? "px-2 py-2 xl:px-3 xl:py-1.5" : "px-3 py-1.5",
    "text-sm transition-all duration-300 ease-in-out flex items-center justify-center font-normal overflow-hidden",
    iconOnlyBelow ? "gap-0 xl:gap-2" : "gap-2"
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={triggerClass}
            aria-label="Profile menu"
            aria-haspopup="menu"
            aria-expanded={open}
            // keep clickable even while auth is loading
            aria-busy={loading || undefined}
          >
            <User className="h-4 w-4 shrink-0" />
            <span className={cn(labelTransitionClass, "transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden")}>Profile</span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="min-w-[210px]"
        >
          <DropdownMenuItem onSelect={() => goOrSignIn("/account")}>
            <User className="h-4 w-4 mr-2" />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => goOrSignIn("/bookmarks")}>
            <Bookmark className="h-4 w-4 mr-2" />
            Bookmarks
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => goOrSignIn("/notes")}>
            <StickyNote className="h-4 w-4 mr-2" />
            Notes
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => goOrSignIn("/recent")}>
            <Clock3 className="h-4 w-4 mr-2" />
            Recent reading
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => goOrSignIn("/notifications")}>
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {user ? (
            <DropdownMenuItem
              onSelect={() => {
                logOut().finally(() => router.push("/quran"));
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => router.push("/signin")}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign in
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
