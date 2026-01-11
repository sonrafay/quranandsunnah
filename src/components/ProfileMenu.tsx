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

  // Determine if we should hide the label based on breakpoint
  const labelHiddenClass = iconOnlyBelow === "xl" ? "hidden xl:inline" :
                          iconOnlyBelow === "lg" ? "hidden lg:inline" :
                          iconOnlyBelow === "md" ? "hidden md:inline" :
                          iconOnlyBelow === "sm" ? "hidden sm:inline" : "";

  // Icon-only mode uses padding, full mode uses px-3 py-1.5
  const triggerClass = cn(
    "rounded-full border bg-background/60 backdrop-blur",
    iconOnlyBelow ? "p-2 xl:px-3 xl:py-1.5" : "px-3 py-1.5",
    "text-sm hover:bg-muted transition flex items-center gap-2 font-normal"
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
            <User className="h-4 w-4" />
            <span className={labelHiddenClass || undefined}>Profile</span>
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
