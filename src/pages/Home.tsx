import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { StarFieldBackground } from "@/components/effects/StarFieldBackground";
import { trpc } from "@/providers/trpc";
import { useStaticData } from "@/hooks/useStaticData";
import { formatDZD } from "@/lib/utils";
import { ImageFallback } from "@/components/ImageFallback";
import {
  Search,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const CATEGORIES = [
  { label: "All", value: "all" },
  { label: "PC Parts", value: "pc_part" },
  { label: "Laptops", value: "laptop" },
  { label: "Monitors", value: "monitor" },
  { label: "Accessories", value: "accessory" },
];

const STEPS = [
  {
    num: "01",
    title: "We Scan the Market",
    desc: "Our automated system checks prices from 15+ Algerian stores and classifieds every 24 hours.",
  },
  {
    num: "02",
    title: "You Search & Compare",
    desc: "Find any product and instantly see prices across all stores with freshness indicators.",
  },
  {
    num: "03",
    title: "You Save Money",
    desc: "Buy from the cheapest source. Average savings of 15,000 DZD per purchase.",
  },
];

export function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const carouselRef = useRef<HTMLDivElement>(null);

  // Try tRPC first, fallback to static data
  const { data: categoryData, isError: trpcError } = trpc.product.byCategory.useQuery(
    {
      category: activeCategory === "all" ? "pc_part" : (activeCategory as any),
      limit: 10,
    },
    { enabled: true, retry: false }
  );

  const { byCategory } = useStaticData();

  // Use tRPC data if available, otherwise use static data
  const displayProducts = trpcError || !categoryData?.length
    ? byCategory(activeCategory === "all" ? "pc_part" : activeCategory, 10).map((p) => ({
        id: p.id,
        canonicalName: p.name,
        category: p.category,
        brand: p.brand,
        model: p.model,
        storeImageUrl: p.imageUrl,
        fallbackImageUrl: null,
        bestPrice: p.bestPrice,
        listingCount: p.listingCount,
      }))
    : categoryData.map((p: any) => ({
        id: p.id,
        canonicalName: p.canonicalName,
        category: p.category,
        brand: p.brand,
        model: p.model,
        storeImageUrl: p.storeImageUrl,
        fallbackImageUrl: p.fallbackImageUrl,
        bestPrice: p.bestPrice,
        listingCount: p.listingCount,
      }));

  const handleSearch = () => {
    if (searchQuery.trim()) {
      const catParam =
        activeCategory !== "all" ? `&category=${activeCategory}` : "";
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}${catParam}`);
    }
  };

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="bg-[#050505] min-h-screen">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden" style={{ height: "100vh" }}>
        <StarFieldBackground />

        <div
          className="relative flex flex-col items-center justify-center h-full px-6"
          style={{ zIndex: 1 }}
        >
          <p className="text-[13px] text-[#6B6B6B] uppercase tracking-[0.1em] mb-6">
            ALGERIAN PRICE COMPARISON BY ASARU
          </p>

          <h1
            className="text-center font-normal text-[#F5F5F0]"
            style={{
              fontSize: "clamp(48px, 8vw, 96px)",
              lineHeight: 1.0,
              letterSpacing: "-0.02em",
            }}
          >
            <span className="text-[#FFB800]">Deal</span> Finder
            <br />
            Algeria
          </h1>

          <p className="text-[15px] text-[#A0A0A0] text-center max-w-[480px] mt-6 leading-relaxed">
            Compare prices across 15+ Algerian stores. Updated every 24 hours.
          </p>

          {/* Search Bar */}
          <div className="w-full max-w-[640px] mt-10 relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search RTX 4060, Ryzen 7, ThinkPad..."
              className="w-full h-14 bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg pl-14 pr-5 text-[14px] text-[#F5F5F0] placeholder:text-[#6B6B6B] focus:border-[#FFB800] focus:outline-none focus:ring-[3px] focus:ring-[rgba(255,184,0,0.15)] transition-all"
            />
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`px-5 py-2 rounded-full border text-[13px] transition-all ${
                  activeCategory === cat.value
                    ? "bg-[#FFB800] border-[#FFB800] text-[#050505] font-medium"
                    : "border-[#1A1A1A] text-[#A0A0A0] hover:border-[#2A2A2A] hover:text-[#F5F5F0]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleSearch}
            className="mt-6 h-12 px-8 bg-[#FFB800] text-[#050505] font-medium text-[15px] rounded-lg hover:bg-[#E5A600] transition-all hover:-translate-y-0.5"
          >
            Search Prices
          </button>

          <p className="text-[13px] text-[#6B6B6B] mt-8">
            PC Parts & Laptops &bull; Compare & Save &bull; Powered by ASARU
          </p>

          {/* Scroll Indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-px h-10 bg-[#6B6B6B] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-[#F5F5F0] animate-[bounce_2s_infinite]" />
            </div>
          </div>
        </div>
      </section>

      {/* Trending Products */}
      <section className="py-20 md:py-32">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center justify-between mb-8">
            <h2
              className="font-normal text-[#F5F5F0]"
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              Trending Now
            </h2>
            <button
              onClick={() => navigate("/search?q=rtx")}
              className="text-[13px] text-[#FFB800] hover:opacity-80 transition-opacity"
            >
              View All &rarr;
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => scrollCarousel("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#0A0A0A] border border-[#1A1A1A] text-[#A0A0A0] hover:border-[#FFB800] hover:text-[#FFB800] transition-all flex items-center justify-center -ml-5"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollCarousel("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#0A0A0A] border border-[#1A1A1A] text-[#A0A0A0] hover:border-[#FFB800] hover:text-[#FFB800] transition-all flex items-center justify-center -mr-5"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div
              ref={carouselRef}
              className="flex gap-4 overflow-x-auto scroll-snap-x pb-4"
              style={{ scrollbarWidth: "none" }}
            >
              {displayProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="flex-shrink-0 w-[280px] bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4 cursor-pointer transition-all hover:border-[#2A2A2A] hover:bg-[#111111] hover:-translate-y-0.5 text-left scroll-snap-start"
                >
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-[#111]">
                    <ImageFallback
                      src={(product as any).storeImageUrl || (product as any).fallbackImageUrl || null}
                      alt={(product as any).canonicalName || (product as any).name || "Product"}
                      category={(product as any).category}
                      className="w-full h-full"
                    />
                    {(product as any).brand && (
                      <span className="absolute top-2 right-2 bg-[rgba(5,5,5,0.8)] px-2 py-1 rounded-md text-[11px] text-[#A0A0A0]">
                        {(product as any).brand}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[15px] font-medium text-[#F5F5F0] mt-3 line-clamp-2">
                    {(product as any).canonicalName || (product as any).name || "Product"}
                  </h3>
                  <p className="text-[13px] text-[#6B6B6B] mt-1">
                    {(product as any).model || ""}
                  </p>
                  <div className="flex items-baseline gap-2 mt-3">
                    <span className="text-[16px] font-medium text-[#22C55E]">
                      {(product as any).bestPrice ? formatDZD((product as any).bestPrice) : "N/A"}
                    </span>
                    <span className="text-[13px] text-[#6B6B6B]">
                      at {(product as any).listingCount || 1} stores
                    </span>
                  </div>
                </button>
              ))}

              {!displayProducts?.length &&
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-[280px] bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4 animate-pulse-skeleton"
                  >
                    <div className="w-full aspect-square rounded-lg bg-[#1A1A1A]" />
                    <div className="h-4 bg-[#1A1A1A] rounded mt-3 w-3/4" />
                    <div className="h-3 bg-[#1A1A1A] rounded mt-2 w-1/2" />
                    <div className="h-4 bg-[#1A1A1A] rounded mt-3 w-1/3" />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-32 border-t border-[#1A1A1A]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2
            className="font-normal text-[#F5F5F0] text-center mb-16"
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <div key={step.num} className="text-center md:text-left">
                <span
                  className="text-[#FFB800] opacity-50"
                  style={{
                    fontSize: "clamp(28px, 4vw, 40px)",
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {step.num}
                </span>
                <h3 className="text-[20px] font-medium text-[#F5F5F0] mt-3 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-[15px] text-[#A0A0A0] mt-2 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1A1A1A] py-12">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3">
                <img
                  src="/asaru-logo.png"
                  alt="ASARU"
                  className="w-10 h-10 rounded-lg object-contain"
                />
                <div>
                  <h3 className="text-[18px] font-medium text-[#F5F5F0]">
                    Deal Finder DZ
                  </h3>
                  <p className="text-[12px] text-[#6B6B6B]">
                    by ASARU
                  </p>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-[14px] font-medium text-[#F5F5F0] mb-3">
                Navigate
              </h4>
              <div className="space-y-2">
                <Link
                  to="/search"
                  className="block text-[15px] text-[#A0A0A0] hover:text-[#F5F5F0] transition-colors"
                >
                  Search
                </Link>
                <Link
                  to="/search?q=rtx"
                  className="block text-[15px] text-[#A0A0A0] hover:text-[#F5F5F0] transition-colors"
                >
                  Trending
                </Link>
              </div>
            </div>
            <div>
              <h4 className="text-[14px] font-medium text-[#F5F5F0] mb-3">
                Stores
              </h4>
              <div className="space-y-2">
                <span className="block text-[15px] text-[#A0A0A0]">CHB-Store</span>
                <span className="block text-[15px] text-[#A0A0A0]">Gaming DZ</span>
                <span className="block text-[15px] text-[#A0A0A0]">DigiTec DZ</span>
                <span className="block text-[15px] text-[#A0A0A0]">LICB+</span>
              </div>
            </div>
            <div>
              <h4 className="text-[14px] font-medium text-[#F5F5F0] mb-3">
                About
              </h4>
              <div className="flex items-center gap-2">
                <img
                  src="/asaru-logo.png"
                  alt="ASARU"
                  className="w-6 h-6 rounded object-contain"
                />
                <span className="text-[13px] text-[#6B6B6B]">
                  Built by ASARU
                </span>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-[#1A1A1A] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[13px] text-[#6B6B6B]">
              &copy; 2025 Deal Finder DZ
            </p>
            <p className="text-[13px] text-[#6B6B6B]">
              Crafted by ASARU
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
