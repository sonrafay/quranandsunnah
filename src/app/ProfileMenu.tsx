"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  User,
  Bookmark,
  StickyNote,
  Clock,
  Bell,
  LogOut,
} from "lucide-react";

export default function ProfileMenu() {
  const { user, loading, logOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/";

  function go(target: string) {
    if (!user) {
      router.push(`/signin?next=${encodeURIComponent(target)}`);
    } else {
      router.push(target);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="font-normal rounded-full border bg-background/60 backdrop-blur px-3 py-1.5 text-sm hover:bg-muted transition flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          <span>Profile</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="text-xs">
          {loading ? "Loading…" : user?.email || "Not signed in"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => go("/account")}>
          <User className="h-4 w-4 mr-2" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/bookmarks")}>
          <Bookmark className="h-4 w-4 mr-2" />
          Bookmarks
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/notes")}>
          <StickyNote className="h-4 w-4 mr-2" />
          Notes
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/recent")}>
          <Clock className="h-4 w-4 mr-2" />
          Recent readings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/notifications")}>
          <Bell className="h-4 w-4 mr-2" />
          Notifications
        </DropdownMenuItem>

        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onSelect={async () => {
                await logOut();
                // after sign out, return them to the current page or home
                router.replace(pathname.startsWith("/signin") ? "/quran" : pathname);
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
