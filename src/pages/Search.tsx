import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useStaticData } from "@/hooks/useStaticData";
import {
  formatDZD,
  getFreshness,
  getSourceBadgeColor,
  getFreshnessColor,
  getFreshnessDot,
} from "@/lib/utils";
import { ImageFallback } from "@/components/ImageFallback";
import {
  Search,
  Loader2,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

const CATEGORIES = [
  { label: "All", value: "all" },
  { label: "PC Parts", value: "pc_part" },
  { label: "Laptops", value: "laptop" },
  { label: "Monitors", value: "monitor" },
  { label: "Accessories", value: "accessory" },
];

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCategory =
    (searchParams.get("category") as
      | "all"
      | "pc_part"
      | "laptop"
      | "monitor"
      | "accessory") || "all";

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [hasSearched, setHasSearched] = useState(initialQuery.length > 0);

  const {
    data: searchData,
    isLoading: trpcLoading,
    isError: trpcError,
    refetch,
  } = trpc.search.search.useQuery(
    { q: query || "rtx", category },
    { enabled: query.length > 0, retry: false }
  );

  const { search: staticSearch, loading: staticLoading } = useStaticData();

  // Determine which data source to use
  const isLoading = trpcLoading || (trpcError && staticLoading);
  const useStatic = trpcError || (searchData?.results?.length === 0 && query.length > 0);

  const staticResults = useStatic
    ? staticSearch(query || "rtx", category).map((p) => ({
        product: {
          id: p.id,
          name: p.name,
          category: p.category,
          brand: p.brand,
          model: p.model,
          specs: p.specs,
          imageUrl: p.imageUrl,
        },
        listingCount: p.listingCount,
        bestPrice: p.bestPrice,
        bestStore: p.bestStore,
        bestLocation: p.bestLocation,
        bestCondition: "new",
        allListings: p.listings,
      }))
    : [];

  const results = useStatic
    ? staticResults
    : (searchData?.results || []).map((r: any) => ({
        product: {
          id: r.product?.id || r.id,
          name: r.product?.name || r.name || r.canonicalName,
          category: r.product?.category || r.category,
          brand: r.product?.brand || r.brand,
          model: r.product?.model || r.model,
          specs: r.product?.specs || r.specs,
          imageUrl: r.product?.imageUrl || r.imageUrl,
        },
        listingCount: r.listingCount || r.listings?.length || 0,
        bestPrice: r.bestPrice || r.listings?.[0]?.price,
        bestStore: r.bestStore || r.listings?.[0]?.sourceName,
        bestLocation: r.bestLocation || r.listings?.[0]?.location,
        allListings: r.allListings || r.listings || [],
      }));

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setHasSearched(true);
    }
  }, [initialQuery]);

  const handleSearch = () => {
    if (query.trim()) {
      setHasSearched(true);
      setSearchParams({ q: query.trim(), category });
      refetch();
    }
  };

  const handleCategoryChange = (newCat: typeof category) => {
    setCategory(newCat);
    if (query.trim()) {
      setSearchParams({ q: query.trim(), category: newCat });
    }
  };

  return (
    <div className="bg-[#050505] min-h-screen pt-20">
      {/* Search Header */}
      <div
        className="sticky top-0 z-40 border-b border-[#1A1A1A]"
        style={{
          background: "rgba(5,5,5,0.95)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex flex-col md:flex-row items-start md:items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="text-[14px] font-medium tracking-[0.05em] text-[#FFB800] shrink-0"
          >
            Deal Finder DZ
          </button>

          <div className="flex-1 w-full md:w-auto flex items-center gap-3">
            <div className="relative flex-1 max-w-[500px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search products..."
                className="w-full h-11 bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg pl-11 pr-4 text-[14px] text-[#F5F5F0] placeholder:text-[#6B6B6B] focus:border-[#FFB800] focus:outline-none focus:ring-[3px] focus:ring-[rgba(255,184,0,0.15)] transition-all"
              />
            </div>

            <div className="relative">
              <select
                value={category}
                onChange={(e) =>
                  handleCategoryChange(e.target.value as typeof category)
                }
                className="h-11 bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg px-4 pr-10 text-[13px] text-[#A0A0A0] focus:border-[#FFB800] focus:outline-none appearance-none cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B] pointer-events-none" />
            </div>

            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="h-11 px-5 bg-[#FFB800] text-[#050505] font-medium text-[14px] rounded-lg hover:bg-[#E5A600] transition-all disabled:opacity-50 shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Search"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6 animate-pulse-skeleton"
              >
                <div className="flex gap-6">
                  <div className="w-44 h-44 bg-[#1A1A1A] rounded-lg shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-[#1A1A1A] rounded w-1/3" />
                    <div className="h-4 bg-[#1A1A1A] rounded w-1/4" />
                    <div className="h-20 bg-[#1A1A1A] rounded w-full mt-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : results.length > 0 ? (
          <>
            <p className="text-[13px] text-[#6B6B6B] mb-6">
              Found {results.length} result{results.length > 1 ? "s" : ""} for &quot;{query}&quot;
              {useStatic && <span className="text-[#FFB800] ml-2">(offline mode)</span>}
            </p>

            <div className="space-y-4">
              {results.map((result: any) => (
                <ProductComparisonCard
                  key={result.product.id}
                  result={result}
                  onProductClick={() =>
                    navigate(`/product/${result.product.id}`)
                  }
                />
              ))}
            </div>
          </>
        ) : hasSearched ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search className="w-12 h-12 text-[#6B6B6B] mb-4" />
            <h3 className="text-[20px] font-medium text-[#A0A0A0]">
              No results found
            </h3>
            <p className="text-[15px] text-[#6B6B6B] mt-2">
              Try a different search term or category
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <Search className="w-12 h-12 text-[#6B6B6B] mb-4" />
            <h3 className="text-[20px] font-medium text-[#A0A0A0]">
              Start searching
            </h3>
            <p className="text-[15px] text-[#6B6B6B] mt-2">
              Enter a product name to compare prices
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductComparisonCard({
  result,
  onProductClick,
}: {
  result: any;
  onProductClick: () => void;
}) {
  const bestPrice = result.bestPrice;
  const freshness = result.allListings?.[0]?.scrapedAt
    ? getFreshness(result.allListings[0].scrapedAt)
    : null;

  return (
    <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6 transition-all hover:border-[#2A2A2A]">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Image */}
        <button
          onClick={onProductClick}
          className="w-full md:w-44 h-44 shrink-0 rounded-lg overflow-hidden bg-[#0D0D0D] cursor-pointer"
        >
          <ImageFallback
            src={result.product.imageUrl}
            alt={result.product.name}
            category={result.product.category}
            className="w-full h-full"
          />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <button
            onClick={onProductClick}
            className="text-left cursor-pointer group"
          >
            <h3 className="text-[20px] font-medium text-[#F5F5F0] group-hover:text-[#FFB800] transition-colors tracking-tight">
              {result.product.name}
            </h3>
          </button>

          {result.product.specs && Object.keys(result.product.specs).length > 0 && (
            <p className="text-[13px] text-[#A0A0A0] mt-1">
              {Object.entries(result.product.specs)
                .map(([, v]) => `${v}`)
                .join(" • ")}
            </p>
          )}

          {result.product.category && (
            <span className="inline-block mt-2 px-2.5 py-0.5 bg-[rgba(255,184,0,0.1)] text-[#FFB800] text-[11px] rounded-md capitalize">
              {result.product.category.replace("pc_part", "PC Part").replace("_", " ")}
            </span>
          )}

          {/* Price Comparison */}
          <div className="mt-4">
            <p className="text-[13px] text-[#6B6B6B] uppercase tracking-[0.05em] mb-3">
              Price Comparison
            </p>
            <div className="space-y-0">
              {result.allListings?.slice(0, 4).map((listing: any) => {
                const badge = getSourceBadgeColor(listing.sourceType);
                const isBest = listing.price === bestPrice;

                return (
                  <div
                    key={listing.id}
                    className="flex items-center gap-3 py-2.5 border-b border-[#1A1A1A] last:border-0"
                  >
                    <span
                      className={`shrink-0 px-2.5 py-0.5 rounded-md text-[11px] ${badge.bg} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-[14px] text-[#F5F5F0] truncate">
                      {listing.sourceName}
                      {listing.location && (
                        <span className="text-[#6B6B6B]">
                          {" "}
                          • {listing.location}
                        </span>
                      )}
                    </span>
                    <span className="text-[13px] text-[#6B6B6B] border border-[#1A1A1A] px-2 py-0.5 rounded-md shrink-0 capitalize">
                      {listing.condition}
                    </span>
                    <span className="ml-auto shrink-0 flex items-center gap-2">
                      {isBest && (
                        <span className="text-[10px] text-[#22C55E] font-medium">
                          BEST
                        </span>
                      )}
                      <span
                        className={`text-[16px] font-medium ${
                          isBest ? "text-[#22C55E]" : "text-[#F5F5F0]"
                        }`}
                      >
                        {formatDZD(listing.price)}
                      </span>
                      <a
                        href={listing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-3 border border-[#1A1A1A] rounded-lg text-[13px] text-[#A0A0A0] hover:border-[#FFB800] hover:text-[#FFB800] transition-all flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Visit
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[#1A1A1A] flex items-center justify-between">
        {freshness && freshness.variant !== "expired" && (
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${getFreshnessDot(freshness.variant)}`}
            />
            <span className={`text-[13px] ${getFreshnessColor(freshness.variant)}`}>
              {freshness.label}
            </span>
          </div>
        )}
        <span className="text-[13px] text-[#6B6B6B] ml-auto">
          {result.listingCount} stores compared
        </span>
      </div>
    </div>
  );
}
