"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { onIncomingFriendRequests } from "@/lib/cloud";
import { Button } from "@/components/ui/button";
import { Users, X } from "lucide-react";

export default function FriendRequestBanner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [requestCount, setRequestCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Track if we've shown banner for these requests this session
  const dismissedCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading || !user) {
      setRequestCount(0);
      setDismissed(false);
      dismissedCountRef.current = null;
      return;
    }

    // Subscribe to incoming friend requests
    const unsub = onIncomingFriendRequests(user.uid, (requests) => {
      setRequestCount(requests.length);

      // If count changed (new requests), un-dismiss to show banner again
      if (dismissedCountRef.current !== null && requests.length > dismissedCountRef.current) {
        setDismissed(false);
      }
    });

    return () => unsub();
  }, [user, loading]);

  // Don't show on the friends page itself
  if (pathname === "/friends" || pathname?.startsWith("/friends/")) {
    return null;
  }

  // Don't show if no requests, dismissed, or not logged in
  if (requestCount === 0 || dismissed || !user) {
    return null;
  }

  function handleViewRequests() {
    router.push("/friends");
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setDismissed(true);
    dismissedCountRef.current = requestCount;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-40 animate-in slide-in-from-bottom-4 duration-300"
      role="alert"
    >
      <div
        className="rounded-xl glass-surface glass-readable p-3 flex items-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors shadow-lg max-w-[280px]"
        onClick={handleViewRequests}
      >
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">
            {requestCount === 1
              ? "1 friend request"
              : `${requestCount} friend requests`}
          </div>
          <div className="text-xs text-muted-foreground">
            Tap to view
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="flex-shrink-0 h-6 w-6 p-0"
          onClick={handleDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
