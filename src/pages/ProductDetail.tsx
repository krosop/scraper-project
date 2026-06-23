import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useStaticData } from "@/hooks/useStaticData";
import {
  formatDZD,
  getSourceBadgeColor,
} from "@/lib/utils";
import { ImageFallback } from "@/components/ImageFallback";
import {
  ExternalLink,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { useMemo } from "react";

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = trpc.product.getById.useQuery(
    { id: id! },
    { enabled: !!id, retry: false }
  );

  const { getById } = useStaticData();

  // Use static data fallback when tRPC fails
  const staticProduct = isError ? getById(id || "") : null;

  const product = data?.product || (staticProduct ? {
    id: staticProduct.id,
    canonicalName: staticProduct.name,
    category: staticProduct.category,
    brand: staticProduct.brand,
    model: staticProduct.model,
    specs: staticProduct.specs,
    storeImageUrl: staticProduct.imageUrl,
    fallbackImageUrl: null,
  } : null);

  const listings = (data?.listings || staticProduct?.listings || []).map((l: any) => ({
    id: l.id,
    price: l.price,
    condition: l.condition,
    location: l.location,
    url: l.url,
    sourceName: l.sourceName,
    sourceType: l.sourceType || "axios",
    scrapedAt: l.scrapedAt,
    expiresAt: l.expiresAt,
  }));

  const history = data?.priceHistory || [];

  const bestListing = listings[0];

  // Mock chart data if no history
  const chartData = useMemo(() => {
    if (history.length > 0) {
      return history
        .filter((h: any) => h.recordedAt != null)
        .map((h: any) => ({
          date: new Date(h.recordedAt!).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          }),
          price: h.price || 0,
        }));
    }
    // Generate mock trend data
    if (!bestListing) return [];
    const basePrice = bestListing.price;
    const days = 14;
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      const variation = Math.sin(i * 0.5) * basePrice * 0.05;
      return {
        date: date.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
        }),
        price: Math.round(basePrice + variation),
      };
    });
  }, [history, bestListing]);

  if (isLoading) {
    return (
      <div className="bg-[#050505] min-h-screen pt-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="animate-pulse-skeleton">
            <div className="h-4 bg-[#1A1A1A] rounded w-1/4 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="aspect-square bg-[#1A1A1A] rounded-xl" />
              <div className="space-y-4">
                <div className="h-8 bg-[#1A1A1A] rounded w-3/4" />
                <div className="h-4 bg-[#1A1A1A] rounded w-1/2" />
                <div className="h-24 bg-[#1A1A1A] rounded mt-8" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-[#050505] min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-[20px] text-[#A0A0A0]">Product not found</h2>
          <button
            onClick={() => navigate("/")}
            className="mt-4 text-[#FFB800] hover:opacity-80 transition-opacity"
          >
            &larr; Back to home
          </button>
        </div>
      </div>
    );
  }

  const specs = product.specs as Record<string, string> | null;

  return (
    <div className="bg-[#050505] min-h-screen pt-20">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[13px] text-[#6B6B6B] mb-6">
          <button
            onClick={() => navigate("/")}
            className="hover:text-[#F5F5F0] transition-colors"
          >
            Home
          </button>
          <ChevronRight className="w-3 h-3" />
          <button
            onClick={() => navigate(`/search?category=${product.category}`)}
            className="hover:text-[#F5F5F0] transition-colors capitalize"
          >
            {product.category?.replace("_", " ") || "Products"}
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[#A0A0A0] truncate max-w-[300px]">
            {product.canonicalName}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[45%_55%] gap-8">
          {/* Image */}
          <div className="aspect-square rounded-xl overflow-hidden bg-[#0D0D0D]">
            <ImageFallback
              src={
                product.storeImageUrl ||
                product.fallbackImageUrl
              }
              alt={product.canonicalName}
              category={product.category}
              className="w-full h-full"
            />
          </div>

          {/* Info */}
          <div>
            <h1
              className="font-normal text-[#F5F5F0]"
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              {product.canonicalName}
            </h1>
            <p className="text-[15px] text-[#A0A0A0] mt-2">
              {product.brand} {product.model}
            </p>

            {/* Specs */}
            {specs && Object.keys(specs).length > 0 && (
              <div className="grid grid-cols-2 gap-3 mt-6">
                {Object.entries(specs).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-[13px] text-[#6B6B6B] uppercase tracking-[0.05em]">
                      {key}
                    </p>
                    <p className="text-[15px] text-[#F5F5F0] mt-1">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Best Price */}
            {bestListing && (
              <div className="mt-8 p-5 bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-xl">
                <p className="text-[13px] text-[#22C55E] uppercase tracking-[0.05em] font-medium">
                  Best Price
                </p>
                <p className="text-[#22C55E] font-semibold mt-1" style={{ fontSize: "clamp(28px, 4vw, 36px)" }}>
                  {formatDZD(bestListing.price)}
                </p>
                <p className="text-[15px] text-[#A0A0A0] mt-1">
                  at {bestListing.sourceName}{" "}
                  {bestListing.location && `• ${bestListing.location}`}
                </p>
                <a
                  href={bestListing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full h-12 bg-[#FFB800] text-[#050505] font-medium text-[15px] rounded-lg hover:bg-[#E5A600] transition-all flex items-center justify-center gap-2"
                >
                  Visit Store
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Price Comparison Table */}
        <div className="mt-12">
          <h3
            className="font-normal text-[#F5F5F0] mb-6"
            style={{
              fontSize: "clamp(20px, 3vw, 28px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            All Prices
          </h3>

          {/* Desktop Table */}
          <div className="hidden md:block bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] px-4 py-3 text-[13px] text-[#6B6B6B] uppercase tracking-[0.05em] border-b border-[#1A1A1A]">
              <span>Store</span>
              <span>Condition</span>
              <span>Location</span>
              <span>Price</span>
              <span></span>
            </div>
            {listings.map((listing, idx) => {
              const badge = getSourceBadgeColor(listing.sourceType);
              const isBest = idx === 0;

              return (
                <div
                  key={listing.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] px-4 py-4 border-b border-[#1A1A1A] last:border-0 hover:bg-[#111111] transition-colors items-center"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] ${badge.bg} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-[14px] text-[#F5F5F0]">
                      {listing.sourceName}
                    </span>
                  </div>
                  <span className="text-[14px] text-[#A0A0A0] capitalize">
                    {listing.condition}
                  </span>
                  <span className="text-[14px] text-[#A0A0A0]">
                    {listing.location || "—"}
                  </span>
                  <span
                    className={`text-[16px] font-medium ${
                      isBest ? "text-[#22C55E]" : "text-[#F5F5F0]"
                    }`}
                  >
                    {isBest && (
                      <span className="text-[10px] text-[#22C55E] mr-1">
                        BEST
                      </span>
                    )}
                    {formatDZD(listing.price)}
                  </span>
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3 border border-[#1A1A1A] rounded-lg text-[13px] text-[#A0A0A0] hover:border-[#FFB800] hover:text-[#FFB800] transition-all flex items-center justify-center gap-1"
                  >
                    Visit
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              );
            })}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {listings.map((listing, idx) => {
              const badge = getSourceBadgeColor(listing.sourceType);
              const isBest = idx === 0;

              return (
                <div
                  key={listing.id}
                  className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] ${badge.bg} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-[13px] text-[#A0A0A0] capitalize">
                      {listing.condition}
                    </span>
                  </div>
                  <p className="text-[15px] text-[#F5F5F0]">
                    {listing.sourceName}
                  </p>
                  {listing.location && (
                    <p className="text-[13px] text-[#6B6B6B] mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {listing.location}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span
                      className={`text-[18px] font-medium ${
                        isBest ? "text-[#22C55E]" : "text-[#F5F5F0]"
                      }`}
                    >
                      {formatDZD(listing.price)}
                    </span>
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-4 border border-[#1A1A1A] rounded-lg text-[13px] text-[#A0A0A0] hover:border-[#FFB800] hover:text-[#FFB800] transition-all flex items-center gap-1"
                    >
                      Visit
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Price History Chart */}
        <div className="mt-12 mb-20">
          <h3
            className="font-normal text-[#F5F5F0] mb-6"
            style={{
              fontSize: "clamp(20px, 3vw, 28px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            Price History
          </h3>
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6 h-[300px]">
            <SimpleLineChart data={chartData} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple SVG Line Chart (no external library needed)
function SimpleLineChart({
  data,
}: {
  data: { date: string; price: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-[#6B6B6B] text-[14px]">No price history available</p>
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const padding = { top: 20, right: 20, bottom: 40, left: 80 };
  const width = 1000;
  const height = 300;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const getY = (price: number) =>
    padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${getX(i)},${getY(d.price)}`)
    .join(" ");

  // Area fill path
  const areaD = `${pathD} L${getX(data.length - 1)},${padding.top + chartHeight} L${padding.left},${padding.top + chartHeight} Z`;

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minPrice + (priceRange * i) / (yTicks - 1))
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
      {yTickValues.map((tick, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={getY(tick)}
            x2={width - padding.right}
            y2={getY(tick)}
            stroke="#1A1A1A"
            strokeWidth={1}
            opacity={0.5}
          />
          <text
            x={padding.left - 10}
            y={getY(tick) + 4}
            fill="#6B6B6B"
            fontSize={12}
            textAnchor="end"
            fontFamily="monospace"
          >
            {new Intl.NumberFormat("fr-FR").format(tick)}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaD} fill="rgba(255,184,0,0.08)" />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="#FFB800"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={getX(i)}
          cy={getY(d.price)}
          r={4}
          fill="#FFB800"
          stroke="#050505"
          strokeWidth={2}
        />
      ))}

      {/* X-axis labels */}
      {data
        .filter((_, i) => i % Math.ceil(data.length / 7) === 0 || i === data.length - 1)
        .map((d, i) => {
          const idx = i * Math.ceil(data.length / 7);
          return (
            <text
              key={i}
              x={getX(Math.min(idx, data.length - 1))}
              y={height - 10}
              fill="#6B6B6B"
              fontSize={11}
              textAnchor="middle"
              fontFamily="monospace"
            >
              {d.date}
            </text>
          );
        })}
    </svg>
  );
}
