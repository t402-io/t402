export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-[#27272A]" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#50AF95]" />
        </div>
        <span className="text-sm font-medium text-[#71717A] tracking-wide">
          Loading...
        </span>
      </div>
    </div>
  );
}
