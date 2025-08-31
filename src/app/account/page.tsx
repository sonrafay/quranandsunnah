"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/AuthProvider";
import { auth } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { saveProfile } from "@/lib/cloud";

export default function AccountPage() {
  const { user, loading, signInGoogle, logOut } = useAuth();
  const [name, setName] = useState("");

  // Ensure a Firestore profile doc exists/merges on login
  useEffect(() => {
    if (!user) return;
    saveProfile(user.uid, {
      displayName: user.displayName ?? user.email ?? "",
      photoURL: user.photoURL ?? "",
    }).catch(() => {});
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28 space-y-4">
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground">
          Sign in to sync bookmarks and progress across devices.
        </p>
        <Button onClick={signInGoogle}>Sign in with Google</Button>
      </div>
    );
  }

  async function saveName() {
    const newName = name.trim();
    const uid = auth.currentUser?.uid; // ✅ guard against null
    if (!newName || !uid) return;

    await updateProfile(auth.currentUser!, { displayName: newName });
    await saveProfile(uid, { displayName: newName });
    setName("");
    alert("Display name updated!");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground">Manage your profile.</p>
      </header>

      <div className="flex items-center gap-3">
        {user.photoURL ? (
          <Image
            src={user.photoURL}
            alt=""
            width={56}
            height={56}
            className="rounded-full"
          />
        ) : (
          <div className="h-14 w-14 rounded-full bg-muted grid place-items-center text-xs">
            No photo
          </div>
        )}
        <div>
          <div className="font-medium">{user.displayName || user.email}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="font-semibold mb-2">Update display name</div>
        <Input
          placeholder="New name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full md:w-80"
        />
        <div className="mt-3">
          <Button onClick={saveName} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </div>

      <Button variant="outline" onClick={logOut}>
        Sign out
      </Button>
    </div>
  );
}
