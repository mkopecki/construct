"use client";

import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function ShopMartSearchBar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      router.replace(`/shopmart${params.toString() ? `?${params}` : ""}`);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, router]);

  return (
    <div className="search-bar relative w-full max-w-md">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
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
        placeholder="Search products..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search-input pl-9 h-10 rounded-lg border-[#e2e8f0] bg-white text-[#1e293b] placeholder:text-[#94a3b8] focus-visible:ring-[#2563eb]/30 focus-visible:border-[#2563eb]"
      />
    </div>
  );
}
