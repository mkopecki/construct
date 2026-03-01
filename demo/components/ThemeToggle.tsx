"use client";

import { usePathname, useRouter } from "next/navigation";

export default function ThemeToggle() {
  const pathname = usePathname();
  const router = useRouter();

  const isShopMart = pathname.startsWith("/shopmart");
  const targetTheme = isShopMart ? "novabuy" : "shopmart";

  function handleSwitch() {
    // Preserve product page if on detail
    const productMatch = pathname.match(/\/product\/(.+)/);
    if (productMatch) {
      router.push(`/${targetTheme}/product/${productMatch[1]}`);
    } else {
      router.push(`/${targetTheme}`);
    }
  }

  return (
    <button
      onClick={handleSwitch}
      className="theme-toggle fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
      style={{
        background: isShopMart
          ? "linear-gradient(135deg, #7c3aed, #6366f1)"
          : "linear-gradient(135deg, #2563eb, #3b82f6)",
        color: "#fff",
        border: "2px solid rgba(255,255,255,0.2)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span className="text-base">
        {isShopMart ? "⚡" : "☀️"}
      </span>
      Switch to {isShopMart ? "NovaBuy" : "ShopMart"}
    </button>
  );
}
