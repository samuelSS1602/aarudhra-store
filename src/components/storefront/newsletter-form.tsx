"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client-api";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/newsletter", { body: { email, consent } });
      setDone(true);
      toast.success("You're subscribed. Thank you!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't subscribe");
    } finally {
      setLoading(false);
    }
  }

  if (done) return <p className="font-medium">Thanks — you&apos;re on the list.</p>;
  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-2">
      <div className="flex gap-2">
        <label htmlFor="nl-email" className="sr-only">Email address</label>
        <input
          id="nl-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border-0 bg-white px-3.5 text-base text-foreground placeholder:text-subtle-foreground"
        />
        <Button type="submit" variant="accent" loading={loading}>Subscribe</Button>
      </div>
      <label className="flex items-start gap-2 text-xs opacity-90">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-0.5" />
        I agree to receive promotional emails from the store.
      </label>
    </form>
  );
}
