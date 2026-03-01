import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b border-white/[0.04] bg-[#0a0a0c]/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-6 w-6 rounded bg-amber flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[#09090b]">
              <path d="M2 2h4v4H2V2Zm6 0h4v4H8V2ZM2 8h4v4H2V8Zm6 2h4v2H8v-2Z" fill="currentColor"/>
            </svg>
          </div>
          <span className="text-[15px] font-medium tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">
            Construct
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono text-muted-foreground/50 tracking-wider uppercase">
            v0.1
          </span>
        </div>
      </div>
    </header>
  );
}
