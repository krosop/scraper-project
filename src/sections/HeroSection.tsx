import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ShieldCheck, RefreshCw, Zap, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';

import DataStreamBackground from '@/components/DataStreamBackground';

export default function HeroSection() {
  const { t, isRTL } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1, y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

  const titleLines = t.hero_title.split('\n');

  return (
    <section className="relative min-h-[600px] h-[90vh] sm:h-screen flex items-center justify-center overflow-hidden">
      <DataStreamBackground />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e14]/60 via-[#0a0e14]/80 to-[#0a0e14]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(0,212,170,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.3) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

      <motion.div
        initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
        className="relative z-10 max-w-[780px] mx-auto px-4 sm:px-6 text-center w-full"
      >
        <motion.h1
          variants={itemVariants}
          className="mt-4 sm:mt-6 text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold text-white leading-[1.15] tracking-tight"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {titleLines[0]}
          <br />
          <span className="text-[#00d4aa]">{titleLines[1]}</span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mt-5 sm:mt-6 text-sm sm:text-base text-[#7a8a9e] leading-relaxed max-w-[640px] mx-auto"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {t.hero_desc}
        </motion.p>

        <motion.form variants={itemVariants} onSubmit={handleSearch} className="mt-7 sm:mt-9 max-w-[640px] mx-auto">
          <div className={`flex flex-col sm:flex-row items-stretch sm:items-center bg-[#131b26] border border-[#1a2332] rounded-xl transition-all duration-300 ${
              searchFocused ? 'border-[#00d4aa]/50 ring-2 ring-[#00d4aa]/10' : ''
            }`}>
            <div className={`flex items-center flex-1 min-w-0 h-12 sm:h-14 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Search className="w-5 h-5 text-[#4a5568] mx-4 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.hero_search_placeholder}
                className={`flex-1 h-full px-3 text-[15px] text-white placeholder:text-[#4a5568] bg-transparent outline-none min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}
                dir={isRTL ? 'rtl' : 'ltr'}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>
            <button type="submit" className="h-10 sm:h-[42px] mx-1.5 mb-1.5 sm:mb-0 px-5 bg-[#00d4aa] hover:bg-[#00b894] text-[#0a0e14] text-sm font-bold rounded-lg transition-colors duration-200 shrink-0">
              <span className="hidden sm:inline">{t.hero_search_btn}</span>
              <span className="sm:hidden">{t.hero_search_btn_sm}</span>
            </button>
          </div>
        </motion.form>

        <motion.div variants={itemVariants} className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Link
            to="/deals"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#131b26] hover:bg-[#1a2332] border border-[#1a2332] hover:border-[#00d4aa]/30 text-[#c8d0d9] text-sm font-semibold rounded-lg transition-all duration-200"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {t.hero_browse}
          </Link>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-7 sm:mt-9 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {[
            { icon: ShieldCheck, text: t.hero_badge_trust },
            { icon: RefreshCw, text: t.hero_badge_live },
            { icon: Zap, text: t.hero_badge_data },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className={`flex items-center gap-1.5 whitespace-nowrap ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Icon className="w-4 h-4 text-[#4a5568]" />
              <span className="text-[11px] sm:text-[12px] font-medium text-[#4a5568]">{text}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <div className={`absolute bottom-8 sm:bottom-10 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${scrolled ? 'opacity-0' : 'opacity-40'}`}>
        <ChevronDown className="w-5 h-5 text-[#00d4aa] animate-scroll-bounce" />
      </div>
    </section>
  );
}
