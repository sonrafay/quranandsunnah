"use client";

import { useEffect, useState } from "react";
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
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  getFriendsList,
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

  // Load data
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoadingData(false);
      return;
    }

    async function loadData() {
      setLoadingData(true);
      try {
        const [incoming, outgoing, friendsList] = await Promise.all([
          getIncomingFriendRequests(user!.uid),
          getOutgoingFriendRequests(user!.uid),
          getFriendsList(user!.uid),
        ]);
        setIncomingRequests(incoming);
        setOutgoingRequests(outgoing);
        setFriends(friendsList);
      } catch (error) {
        console.error("Failed to load friends data:", error);
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [user, authLoading]);

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
        }
      } else {
        setSearchError("No user found with that handle or ID.");
      }
    } catch (error) {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  // Send friend request
  async function handleSendRequest() {
    if (!user || !searchResult) return;
    setSendingRequest(true);

    try {
      const result = await sendFriendRequest(user.uid, searchResult.uid);
      if (result.success) {
        // Refresh outgoing requests
        const outgoing = await getOutgoingFriendRequests(user.uid);
        setOutgoingRequests(outgoing);
        setSearchResult(null);
        setSearchQuery("");
      } else {
        setSearchError(result.error || "Failed to send request.");
      }
    } catch (error) {
      setSearchError("Failed to send request. Please try again.");
    } finally {
      setSendingRequest(false);
    }
  }

  // Accept friend request
  async function handleAccept(fromUid: string) {
    if (!user) return;
    setProcessingRequests((prev) => new Set(prev).add(fromUid));

    try {
      const result = await acceptFriendRequest(user.uid, fromUid);
      if (result.success) {
        // Refresh data
        const [incoming, friendsList] = await Promise.all([
          getIncomingFriendRequests(user.uid),
          getFriendsList(user.uid),
        ]);
        setIncomingRequests(incoming);
        setFriends(friendsList);
      }
    } catch (error) {
      console.error("Failed to accept request:", error);
    } finally {
      setProcessingRequests((prev) => {
        const next = new Set(prev);
        next.delete(fromUid);
        return next;
      });
    }
  }

  // Decline friend request
  async function handleDecline(fromUid: string) {
    if (!user) return;
    setProcessingRequests((prev) => new Set(prev).add(fromUid));

    try {
      const result = await declineFriendRequest(user.uid, fromUid);
      if (result.success) {
        const incoming = await getIncomingFriendRequests(user.uid);
        setIncomingRequests(incoming);
      }
    } catch (error) {
      console.error("Failed to decline request:", error);
    } finally {
      setProcessingRequests((prev) => {
        const next = new Set(prev);
        next.delete(fromUid);
        return next;
      });
    }
  }

  // Cancel outgoing request
  async function handleCancel(toUid: string) {
    if (!user) return;
    setProcessingRequests((prev) => new Set(prev).add(toUid));

    try {
      const result = await cancelFriendRequest(user.uid, toUid);
      if (result.success) {
        const outgoing = await getOutgoingFriendRequests(user.uid);
        setOutgoingRequests(outgoing);
      }
    } catch (error) {
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
