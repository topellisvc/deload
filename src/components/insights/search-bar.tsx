"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Submits to /insights/search?q=... rather than filtering client-side —
 * search results need their own indexable, shareable URL for SEO
 * (spec: "custom slug" / crawlable pages throughout Insights), and the
 * actual matching happens server-side via searchArticles' Postgres
 * full-text query, not in the browser. */
export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    router.push(trimmed ? `/insights/search?q=${encodeURIComponent(trimmed)}` : "/insights/search");
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="relative w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search articles, topics, or authors…"
        aria-label="Search Insights"
        className="pl-11"
      />
    </form>
  );
}
