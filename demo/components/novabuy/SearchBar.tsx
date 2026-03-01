"use client";

import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function NovaBuySearchBar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      router.replace(`/novabuy${params.toString() ? `?${params}` : ""}`);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, router]);

  return (
    <div className="search-bar relative w-full max-w-md">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280] pointer-events-none"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <Input
        type="search"
        placeholder="Find products..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search-input pl-9 h-10 rounded-lg border-[#2a2a2a] bg-[#1a1a1a] text-[#e5e5e5] placeholder:text-[#6b7280] focus-visible:ring-[#8b5cf6]/30 focus-visible:border-[#8b5cf6]"
      />
    </div>
  );
}
