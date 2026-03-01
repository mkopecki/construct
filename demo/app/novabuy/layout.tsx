import ThemeToggle from "@/components/ThemeToggle";
import CookieConsent from "@/components/novabuy/CookieConsent";

export default function NovaBuyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="novabuy-shell min-h-screen bg-[#0f0f0f] font-[family-name:var(--font-manrope)]">
      {children}
      <CookieConsent />
      <ThemeToggle />
    </div>
  );
}
