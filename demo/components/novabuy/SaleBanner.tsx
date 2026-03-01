export default function SaleBanner() {
  return (
    <div className="sale-banner relative overflow-hidden rounded-xl border border-[#2a2a2a] bg-gradient-to-r from-[#8b5cf6]/10 via-[#6366f1]/10 to-[#8b5cf6]/10 px-6 py-4 mb-8">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgxMzksMTAwLDI0NiwwLjA4KSIvPjwvc3ZnPg==')] opacity-50" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#8b5cf6]/20 text-[#a78bfa] text-sm font-bold">
            %
          </span>
          <div>
            <p className="font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-[#e5e5e5] tracking-wide uppercase">
              Summer Sale
            </p>
            <p className="text-xs text-[#a78bfa]">
              Up to 40% off on selected items
            </p>
          </div>
        </div>
        <span className="font-[family-name:var(--font-jetbrains)] text-2xl font-bold bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] bg-clip-text text-transparent">
          -40%
        </span>
      </div>
    </div>
  );
}
