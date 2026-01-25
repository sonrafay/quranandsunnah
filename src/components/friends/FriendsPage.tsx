"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ProfileCardPreview from "@/components/friends/ProfileCardPreview";
import {
  FriendProfile,
  FriendRelationship,
} from "@/lib/account/models";
import {
  searchUserByHandleOrId,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  onIncomingFriendRequests,
  onOutgoingFriendRequests,
  onFriendsList,
  fetchUserProfile,
} from "@/lib/cloud";
import {
  UserPlus,
  Users,
  Clock,
  Check,
  X,
  Search,
  Lock,
  Bell,
  Trophy,
  Loader2,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";

type IncomingRequest = {
  fromUid: string;
  createdAt: Timestamp;
  profile?: FriendProfile;
};

type OutgoingRequest = {
  toUid: string;
  createdAt: Timestamp;
  profile?: FriendProfile;
};

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<FriendProfile | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequest[]>([]);
  const [friends, setFriends] = useState<FriendRelationship[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());

  // Cache for profiles to avoid refetching
  const profileCache = useRef<Map<string, FriendProfile>>(new Map());

  // Helper to fetch and cache profile
  const getProfile = useCallback(async (uid: string): Promise<FriendProfile | undefined> => {
    if (profileCache.current.has(uid)) {
      return profileCache.current.get(uid);
    }
    const profile = await fetchUserProfile(uid);
    if (profile) {
      profileCache.current.set(uid, profile);
    }
    return profile;
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    let initialLoadComplete = 0;
    const totalSubscriptions = 3;

    const checkInitialLoad = () => {
      initialLoadComplete++;
      if (initialLoadComplete >= totalSubscriptions) {
        setLoadingData(false);
      }
    };

    // Subscribe to incoming friend requests
    const unsubIncoming = onIncomingFriendRequests(user.uid, async (requests) => {
      // Fetch profiles for each request
      const withProfiles = await Promise.all(
        requests.map(async (req) => ({
          ...req,
          profile: await getProfile(req.fromUid),
        }))
      );
      setIncomingRequests(withProfiles);
      checkInitialLoad();
    });

    // Subscribe to outgoing friend requests
    const unsubOutgoing = onOutgoingFriendRequests(user.uid, async (requests) => {
      // Fetch profiles for each request
      const withProfiles = await Promise.all(
        requests.map(async (req) => ({
          ...req,
          profile: await getProfile(req.toUid),
        }))
      );
      setOutgoingRequests(withProfiles);
      checkInitialLoad();
    });

    // Subscribe to friends list
    const unsubFriends = onFriendsList(user.uid, async (friendsData) => {
      // Fetch profiles for each friend
      const withProfiles: FriendRelationship[] = await Promise.all(
        friendsData.map(async (f) => ({
          friendUid: f.friendUid,
          createdAt: f.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          profile: await getProfile(f.friendUid),
        }))
      );
      setFriends(withProfiles);
      checkInitialLoad();
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubIncoming();
      unsubOutgoing();
      unsubFriends();
    };
  }, [user, authLoading, getProfile]);

  // Search handler
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const result = await searchUserByHandleOrId(searchQuery);
      if (result) {
        // Check if it's the current user
        if (result.uid === user?.uid) {
          setSearchError("That's you! Try searching for someone else.");
        } else {
          setSearchResult(result);
          // Cache the profile
          profileCache.current.set(result.uid, result);
        }
      } else {
        setSearchError("No user found with that handle or ID.");
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  // Send friend request with optimistic UI
  async function handleSendRequest() {
    if (!user || !searchResult) return;
    setSendingRequest(true);

    // Optimistic: add to outgoing requests immediately
    const optimisticRequest: OutgoingRequest = {
      toUid: searchResult.uid,
      createdAt: Timestamp.now(),
      profile: searchResult,
    };
    setOutgoingRequests((prev) => [optimisticRequest, ...prev]);
    setSearchResult(null);
    setSearchQuery("");

    try {
      const result = await sendFriendRequest(user.uid, searchResult.uid);
      if (!result.success) {
        // Rollback optimistic update
        setOutgoingRequests((prev) => prev.filter((r) => r.toUid !== optimisticRequest.toUid));
        setSearchError(result.error || "Failed to send request.");
      }
    } catch (error) {
      // Rollback optimistic update
      setOutgoingRequests((prev) => prev.filter((r) => r.toUid !== optimisticRequest.toUid));
      setSearchError("Failed to send request. Please try again.");
    } finally {
      setSendingRequest(false);
    }
  }

  // Accept friend request with optimistic UI
  async function handleAccept(fromUid: string) {
    if (!user) return;
    setProcessingRequests((prev) => new Set(prev).add(fromUid));

    // Find the request being accepted
    const acceptedRequest = incomingRequests.find((r) => r.fromUid === fromUid);

    // Optimistic: remove from incoming, add to friends
    setIncomingRequests((prev) => prev.filter((r) => r.fromUid !== fromUid));
    if (acceptedRequest?.profile) {
      const newFriend: FriendRelationship = {
        friendUid: fromUid,
        createdAt: new Date().toISOString(),
        profile: acceptedRequest.profile,
      };
      setFriends((prev) => [newFriend, ...prev]);
    }

    try {
      const result = await acceptFriendRequest(user.uid, fromUid);
      if (!result.success) {
        // Rollback: restore incoming request, remove from friends
        if (acceptedRequest) {
          setIncomingRequests((prev) => [acceptedRequest, ...prev]);
        }
        setFriends((prev) => prev.filter((f) => f.friendUid !== fromUid));
        console.error("Failed to accept request:", result.error);
      }
    } catch (error) {
      // Rollback
      if (acceptedRequest) {
        setIncomingRequests((prev) => [acceptedRequest, ...prev]);
      }
      setFriends((prev) => prev.filter((f) => f.friendUid !== fromUid));
      console.error("Failed to accept request:", error);
    } finally {
      setProcessingRequests((prev) => {
        const next = new Set(prev);
        next.delete(fromUid);
        return next;
      });
    }
  }

  // Decline friend request with optimistic UI
  async function handleDecline(fromUid: string) {
    if (!user) return;
    setProcessingRequests((prev) => new Set(prev).add(fromUid));

    // Find the request being declined
    const declinedRequest = incomingRequests.find((r) => r.fromUid === fromUid);

    // Optimistic: remove from incoming
    setIncomingRequests((prev) => prev.filter((r) => r.fromUid !== fromUid));

    try {
      const result = await declineFriendRequest(user.uid, fromUid);
      if (!result.success) {
        // Rollback
        if (declinedRequest) {
          setIncomingRequests((prev) => [declinedRequest, ...prev]);
        }
        console.error("Failed to decline request:", result.error);
      }
    } catch (error) {
      // Rollback
      if (declinedRequest) {
        setIncomingRequests((prev) => [declinedRequest, ...prev]);
      }
      console.error("Failed to decline request:", error);
    } finally {
      setProcessingRequests((prev) => {
        const next = new Set(prev);
        next.delete(fromUid);
        return next;
      });
    }
  }

  // Cancel outgoing request with optimistic UI
  async function handleCancel(toUid: string) {
    if (!user) return;
    setProcessingRequests((prev) => new Set(prev).add(toUid));

    // Find the request being canceled
    const canceledRequest = outgoingRequests.find((r) => r.toUid === toUid);

    // Optimistic: remove from outgoing
    setOutgoingRequests((prev) => prev.filter((r) => r.toUid !== toUid));

    try {
      const result = await cancelFriendRequest(user.uid, toUid);
      if (!result.success) {
        // Rollback
        if (canceledRequest) {
          setOutgoingRequests((prev) => [canceledRequest, ...prev]);
        }
        console.error("Failed to cancel request:", result.error);
      }
    } catch (error) {
      // Rollback
      if (canceledRequest) {
        setOutgoingRequests((prev) => [canceledRequest, ...prev]);
      }
      console.error("Failed to cancel request:", error);
    } finally {
      setProcessingRequests((prev) => {
        const next = new Set(prev);
        next.delete(toUid);
        return next;
      });
    }
  }

  // Navigate to friend profile
  function viewFriendProfile(uid: string) {
    router.push(`/friends/${uid}`);
  }

  // Check if user is already a friend
  function isFriend(uid: string): boolean {
    return friends.some((f) => f.friendUid === uid);
  }

  // Check if request already sent
  function hasOutgoingRequest(uid: string): boolean {
    return outgoingRequests.some((r) => r.toUid === uid);
  }

  // Check if has incoming request from user
  function hasIncomingRequest(uid: string): boolean {
    return incomingRequests.some((r) => r.fromUid === uid);
  }

  if (authLoading || loadingData) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">
        <div className="rounded-xl glass-surface glass-readable p-8 text-center space-y-4">
          <Users className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Sign in to view Friends</h2>
          <p className="text-sm text-muted-foreground">
            Connect with friends to encourage one another in worship.
          </p>
          <Button onClick={() => router.push("/signin?next=/friends")}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Friends</h1>
        <p className="text-sm text-muted-foreground">
          Connect with friends to encourage one another in worship.
        </p>
      </header>

      {/* Section 1: Add Friend */}
      <section className="rounded-xl glass-surface glass-readable p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Add Friend</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Search by unique handle or paste a User ID to find friends.
        </p>

        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter handle or User ID"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Search</span>
          </Button>
        </div>

        {searchError && (
          <div className="text-sm text-red-400">{searchError}</div>
        )}

        {searchResult && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Search result:</div>
            <ProfileCardPreview profile={searchResult}>
              {isFriend(searchResult.uid) ? (
                <Badge variant="secondary">Already friends</Badge>
              ) : hasOutgoingRequest(searchResult.uid) ? (
                <Badge variant="secondary">Request sent</Badge>
              ) : hasIncomingRequest(searchResult.uid) ? (
                <Badge variant="secondary">Has sent you a request</Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSendRequest}
                  disabled={sendingRequest}
                >
                  {sendingRequest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-1" />
                      Send Request
                    </>
                  )}
                </Button>
              )}
            </ProfileCardPreview>
          </div>
        )}
      </section>

      {/* Section 2: Friend Requests */}
      <section className="rounded-xl glass-surface glass-readable p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Friend Requests</h2>
        </div>

        {/* Incoming Requests */}
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Incoming ({incomingRequests.length})
          </div>
          {incomingRequests.length === 0 ? (
            <div className="text-sm text-muted-foreground rounded-lg glass-surface glass-readable p-4">
              No incoming requests.
            </div>
          ) : (
            <div className="space-y-2">
              {incomingRequests.map((request) =>
                request.profile ? (
                  <ProfileCardPreview
                    key={request.fromUid}
                    profile={request.profile}
                    size="sm"
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAccept(request.fromUid)}
                      disabled={processingRequests.has(request.fromUid)}
                    >
                      {processingRequests.has(request.fromUid) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">Accept</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDecline(request.fromUid)}
                      disabled={processingRequests.has(request.fromUid)}
                    >
                      <X className="h-4 w-4" />
                      <span className="ml-1 hidden sm:inline">Decline</span>
                    </Button>
                  </ProfileCardPreview>
                ) : null
              )}
            </div>
          )}
        </div>

        {/* Outgoing Requests */}
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Outgoing ({outgoingRequests.length})
          </div>
          {outgoingRequests.length === 0 ? (
            <div className="text-sm text-muted-foreground rounded-lg glass-surface glass-readable p-4">
              No outgoing requests.
            </div>
          ) : (
            <div className="space-y-2">
              {outgoingRequests.map((request) =>
                request.profile ? (
                  <ProfileCardPreview
                    key={request.toUid}
                    profile={request.profile}
                    size="sm"
                  >
                    <Badge variant="secondary">Pending</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancel(request.toUid)}
                      disabled={processingRequests.has(request.toUid)}
                    >
                      {processingRequests.has(request.toUid) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">Cancel</span>
                    </Button>
                  </ProfileCardPreview>
                ) : null
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Friends List */}
      <section className="rounded-xl glass-surface glass-readable p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Your Friends</h2>
          <Badge variant="secondary" className="ml-auto">
            {friends.length}
          </Badge>
        </div>

        {friends.length === 0 ? (
          <div className="text-sm text-muted-foreground rounded-lg glass-surface glass-readable p-4">
            No friends yet. Search for friends above to connect!
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {friends.map((friend) =>
              friend.profile ? (
                <ProfileCardPreview
                  key={friend.friendUid}
                  profile={friend.profile}
                  onClick={() => viewFriendProfile(friend.friendUid)}
                  showStreak={friend.profile.privacy?.shareStreak}
                />
              ) : null
            )}
          </div>
        )}
      </section>

      {/* Section 4: Challenges (Coming Soon) */}
      <section className="rounded-xl glass-surface glass-readable p-5 space-y-4 opacity-60">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Challenges</h2>
          <Badge variant="outline" className="ml-2">
            <Lock className="h-3 w-3 mr-1" />
            Coming Soon
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Challenge your friends to build consistent habits together.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg glass-surface glass-readable p-4 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Fajr 30 Challenge</div>
                <div className="text-xs text-muted-foreground">
                  Pray Fajr for 30 days straight
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-lg glass-surface glass-readable p-4 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Daily Quran Challenge</div>
                <div className="text-xs text-muted-foreground">
                  Read Quran daily for a month
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-center">
          Available in a future update
        </div>
      </section>

      {/* Section 5: Encouragement / Friend Notifications (Coming Soon) */}
      <section className="rounded-xl glass-surface glass-readable p-5 space-y-4 opacity-60">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Encouragement</h2>
          <Badge variant="outline" className="ml-2">
            <Lock className="h-3 w-3 mr-1" />
            Coming Soon
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Send gentle reminders and encouragement to your friends.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg glass-surface glass-readable px-4 py-3 cursor-not-allowed">
            <div>
              <div className="font-medium text-muted-foreground">Send Quran reminder</div>
              <div className="text-xs text-muted-foreground">
                Remind a friend to read Quran today
              </div>
            </div>
            <Button size="sm" disabled variant="outline">
              <Lock className="h-3 w-3 mr-1" />
              Disabled
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg glass-surface glass-readable px-4 py-3 cursor-not-allowed">
            <div>
              <div className="font-medium text-muted-foreground">Send dua notification</div>
              <div className="text-xs text-muted-foreground">
                Let a friend know you made dua for them
              </div>
            </div>
            <Button size="sm" disabled variant="outline">
              <Lock className="h-3 w-3 mr-1" />
              Disabled
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-center">
          Available in a future update
        </div>
      </section>
    </div>
  );
}
