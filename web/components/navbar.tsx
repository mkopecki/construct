import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Construct
        </Link>
      </div>
    </header>
  );
}
