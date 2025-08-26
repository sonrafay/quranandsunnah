"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Profile = {
  name: string;
  email: string;
  photoDataUrl?: string;
};

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile>({ name: "", email: "" });
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    const raw = localStorage.getItem("qs-profile");
    if (raw) {
      try { setProfile(JSON.parse(raw)); } catch {}
    }
  }, []);

  function onFileChange(file?: File) {
    if (!file) return setProfile((p) => ({ ...p, photoDataUrl: undefined }));
    const reader = new FileReader();
    reader.onload = () => setProfile((p) => ({ ...p, photoDataUrl: reader.result as string }));
    reader.readAsDataURL(file);
  }

  async function onSave() {
    setSaved("saving");
    localStorage.setItem("qs-profile", JSON.stringify(profile));
    await new Promise((r) => setTimeout(r, 300));
    setSaved("saved");
    setTimeout(() => setSaved("idle"), 1500);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">
      <h1 className="text-2xl font-bold">Account</h1>
      <p className="text-muted-foreground mt-1">Basic profile settings stored locally for now.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-32 w-32 rounded-full border overflow-hidden bg-muted">
            {profile.photoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoDataUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-sm text-muted-foreground">
                No photo
              </div>
            )}
          </div>
          <label className="text-sm">
            <span className="sr-only">Upload photo</span>
            <Input type="file" accept="image/*" onChange={(e) => onFileChange(e.target.files?.[0])} />
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              className="mt-1"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              className="mt-1"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              placeholder="name@example.com"
            />
          </div>

          <div className="pt-2">
            <Button onClick={onSave} disabled={saved === "saving"}>
              {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved ✓" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
