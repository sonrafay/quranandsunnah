"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Subscribe() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("ok");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Join the early list</h2>
        <p className="text-muted-foreground mt-2">
          Sign up to get updates. Your email stays private.
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
          <Input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 max-w-sm"
          />
          <Button type="submit" className="h-11">Join</Button>
        </form>

        {status === "ok" && (
          <p className="text-green-600 dark:text-green-400 mt-3 text-sm">
            Thank you. You are on the list.
          </p>
        )}
        {status === "error" && (
          <p className="text-red-600 dark:text-red-400 mt-3 text-sm">
            Something went wrong. Please try again or email us.
          </p>
        )}
      </div>
    </div>
  );
}
