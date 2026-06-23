import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Search, TrendingUp } from "lucide-react";

export function Navigation() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (location.pathname === "/" && !visible) return null;

  const isHome = location.pathname === "/";

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        visible || !isHome
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-full pointer-events-none"
      }`}
      style={{
        background: "rgba(5,5,5,0.9)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #1A1A1A",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="text-[14px] font-medium tracking-[0.05em] text-[#FFB800] hover:opacity-80 transition-opacity"
        >
          Deal Finder DZ
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link
            to="/search"
            className="flex items-center gap-2 text-[14px] font-medium tracking-[0.05em] text-[#A0A0A0] hover:text-[#F5F5F0] transition-colors"
          >
            <Search className="w-4 h-4" />
            Search
          </Link>
          <Link
            to="/search?q=trending"
            className="flex items-center gap-2 text-[14px] font-medium tracking-[0.05em] text-[#A0A0A0] hover:text-[#F5F5F0] transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            Trending
          </Link>
        </div>

        <div className="flex md:hidden items-center gap-4">
          <Link to="/search" className="text-[#A0A0A0]">
            <Search className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
