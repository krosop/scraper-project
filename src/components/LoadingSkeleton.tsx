export function CardSkeleton() {
  return (
    <div className="bg-[#111821] border border-[#1a2332] rounded-xl p-3 sm:p-5 animate-pulse">
      <div className="h-44 sm:h-56 bg-[#1a2332] rounded-lg mb-3 sm:mb-5" />
      <div className="h-5 bg-[#1a2332] rounded w-16 mb-2 sm:mb-3" />
      <div className="h-4 bg-[#1a2332] rounded w-full mb-2" />
      <div className="h-4 bg-[#1a2332] rounded w-3/4 mb-2 sm:mb-3" />
      <div className="h-5 bg-[#1a2332] rounded w-24" />
    </div>
  );
}

export function CategorySkeleton() {
  return (
    <div className="bg-[#111821] border border-[#1a2332] rounded-xl p-4 animate-pulse flex items-center gap-4">
      <div className="w-14 h-14 bg-[#1a2332] rounded-lg shrink-0" />
      <div className="flex-1">
        <div className="h-4 bg-[#1a2332] rounded w-24 mb-2" />
        <div className="h-3 bg-[#1a2332] rounded w-16" />
      </div>
    </div>
  );
}

export function DealSkeleton() {
  return (
    <div className="flex-shrink-0 w-[260px] sm:w-[280px] bg-[#111821] border border-[#1a2332] rounded-lg p-3 animate-pulse">
      <div className="h-4 bg-[#1a2332] rounded w-20 mb-2" />
      <div className="h-12 bg-[#1a2332] rounded" />
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="max-w-[720px] mx-auto px-6 text-center">
      <div className="inline-block h-7 bg-[#1a2332] rounded-full w-48 mb-6 animate-pulse" />
      <div className="h-16 bg-[#1a2332] rounded-xl w-full mb-4 animate-pulse" />
      <div className="h-14 bg-[#1a2332] rounded-xl w-full animate-pulse" />
    </div>
  );
}
