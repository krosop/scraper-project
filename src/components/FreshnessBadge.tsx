import { getFreshness, getFreshnessColor, getFreshnessDot } from "@/lib/utils";

interface FreshnessBadgeProps {
  scrapedAt: Date | string;
  className?: string;
}

export function FreshnessBadge({ scrapedAt, className = "" }: FreshnessBadgeProps) {
  const freshness = getFreshness(scrapedAt);

  if (freshness.variant === "expired") return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={`w-2 h-2 rounded-full ${getFreshnessDot(freshness.variant)}`}
      />
      <span className={`text-[13px] ${getFreshnessColor(freshness.variant)}`}>
        {freshness.label}
      </span>
    </div>
  );
}
