"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function CookieConsent() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="cookie-consent fixed bottom-20 left-6 right-6 z-40 mx-auto max-w-lg animate-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-xl border border-[#2a2a2a] bg-[#141414]/95 backdrop-blur-xl p-5 shadow-2xl shadow-black/40">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 text-lg">🍪</span>
          <div className="flex-1">
            <p className="font-[family-name:var(--font-jetbrains)] text-xs font-semibold text-[#e5e5e5] uppercase tracking-wider mb-1">
              Cookie Notice
            </p>
            <p className="text-xs text-[#9ca3af] leading-relaxed">
              We use cookies to enhance your browsing experience and analyze site traffic. By continuing, you agree to our use of cookies.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => setDismissed(true)}
                className="cookie-accept h-8 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:from-[#7c3aed] hover:to-[#4f46e5] text-white border-0 cursor-pointer"
              >
                Accept All
              </Button>
              <Button
                onClick={() => setDismissed(true)}
                variant="outline"
                className="cookie-decline h-8 rounded-lg text-xs font-semibold border-[#2a2a2a] bg-transparent text-[#9ca3af] hover:text-[#e5e5e5] hover:bg-[#1a1a1a] cursor-pointer"
              >
                Decline
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
