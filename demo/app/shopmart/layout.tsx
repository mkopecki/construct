import ThemeToggle from "@/components/ThemeToggle";

export default function ShopMartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="shopmart-shell min-h-screen bg-[#fafbfc] font-[family-name:var(--font-dm-sans)]">
      {children}
      <ThemeToggle />
    </div>
  );
}
