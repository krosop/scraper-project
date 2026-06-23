import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format price in DZD (French number format)
export function formatDZD(price: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(price)} DZD`;
}

// Parse messy DZD price strings
export function parseDZDPrice(input: string): number | null {
  const cleaned = input
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/\.000/g, "000")
    .replace(/da$/i, "")
    .replace(/dzd$/i, "")
    .replace(/dinar/i, "");

  const match = cleaned.match(/(\d+)[kkm]?/);
  if (!match) return null;

  let num = parseInt(match[1], 10);
  if (cleaned.includes("k") || cleaned.includes("m")) {
    num *= 1000;
  }
  return num;
}

// Get freshness info from scrapedAt date
export function getFreshness(scrapedAt: Date | string): {
  label: string;
  hoursAgo: number;
  variant: "fresh" | "stale" | "verify" | "expired";
} {
  const scraped = new Date(scrapedAt);
  const now = new Date();
  const diffMs = now.getTime() - scraped.getTime();
  const hoursAgo = Math.floor(diffMs / (1000 * 60 * 60));

  if (hoursAgo < 6) {
    return { label: `Updated ${hoursAgo}h ago`, hoursAgo, variant: "fresh" };
  } else if (hoursAgo < 24) {
    return { label: `Updated ${hoursAgo}h ago`, hoursAgo, variant: "stale" };
  } else if (hoursAgo < 48) {
    return {
      label: "Verify before visiting",
      hoursAgo,
      variant: "verify",
    };
  }
  return { label: "Expired", hoursAgo, variant: "expired" };
}

// Get freshness badge color classes
export function getFreshnessColor(
  variant: "fresh" | "stale" | "verify" | "expired"
): string {
  switch (variant) {
    case "fresh":
      return "text-[#22C55E]";
    case "stale":
      return "text-[#F59E0B]";
    case "verify":
      return "text-[#EF4444]";
    case "expired":
      return "text-[#6B6B6B]";
  }
}

export function getFreshnessDot(variant: "fresh" | "stale" | "verify" | "expired"): string {
  switch (variant) {
    case "fresh":
      return "bg-[#22C55E]";
    case "stale":
      return "bg-[#F59E0B]";
    case "verify":
      return "bg-[#EF4444]";
    case "expired":
      return "bg-[#6B6B6B]";
  }
}

// Get source badge color classes
export function getSourceBadgeColor(sourceType: string): {
  bg: string;
  text: string;
  label: string;
} {
  switch (sourceType) {
    case "axios":
      return {
        bg: "bg-[rgba(16,185,129,0.15)]",
        text: "text-[#10B981]",
        label: "Store",
      };
    case "playwright":
      return {
        bg: "bg-[rgba(245,158,11,0.15)]",
        text: "text-[#F59E0B]",
        label: "Classified",
      };
    default:
      return {
        bg: "bg-[rgba(139,92,246,0.15)]",
        text: "text-[#8B5CF6]",
        label: "Seller",
      };
  }
}

// Get category icon name from lucide
export function getCategoryIcon(category: string | null): string {
  switch (category) {
    case "phone":
      return "Smartphone";
    case "pc_part":
      return "Cpu";
    case "laptop":
      return "Laptop";
    case "monitor":
      return "Monitor";
    case "accessory":
      return "Headphones";
    default:
      return "Package";
  }
}

// Normalize search query
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "");
}

// Days until expiry
export function getDaysUntilExpiry(expiresAt: Date | string): number {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
