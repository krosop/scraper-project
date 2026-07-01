import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, BarChart3, ShoppingCart, Check, ArrowRight, Shield, Zap, Globe } from 'lucide-react';
import { useTranslation } from '@/i18n/useTranslation';
import NavigationBar from '@/components/NavigationBar';
import SEO from '@/components/SEO';

export default function HowItWorksPage() {
  const { t, isRTL } = useTranslation();

  const steps = [
    {
      num: '01',
      icon: Search,
      title: t.hiw_step1_title,
      desc: t.hiw_step1_desc,
      details: [
        'Search across 112+ Algerian PC stores instantly',
        'Smart search with typo correction and synonyms',
        'Filter by brand, category, price range, and specs',
        'Supports Arabic, French, and English queries',
      ],
    },
    {
      num: '02',
      icon: BarChart3,
      title: t.hiw_step2_title,
      desc: t.hiw_step2_desc,
      details: [
        'Side-by-side price comparison across all stores',
        'Best deal automatically highlighted',
        'Savings calculated on every product',
        'Real-time price updates from Ouedkniss, Hiprospace & more',
      ],
    },
    {
      num: '03',
      icon: ShoppingCart,
      title: t.hiw_step3_title,
      desc: t.hiw_step3_desc,
      details: [
        'Buy directly from the store with the best price',
        'Average savings: 8,000 DZD per component',
        'Full build savings: 50,000+ DZD',
        'No middleman, no fees — just better prices',
      ],
    },
  ];

  const benefits = [
    { icon: Zap, title: 'Live Prices', desc: 'Prices updated daily from all tracked stores.' },
    { icon: Shield, title: 'Verified Stores', desc: 'Only trusted Algerian PC retailers.' },
    { icon: Globe, title: 'Multi-Language', desc: 'Full support for Arabic, French, and English.' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <SEO
        title={`${t.page_hiw_title} — DZ TechHunt`}
        description={t.page_hiw_desc}
        keywords="how it works, PC price comparison Algeria, save on PC build, compare PC prices"
        url="https://dztechhunt-v3.vercel.app/#/how-it-works"
      />
      <NavigationBar />

      <main className="pt-16">
        {/* Header */}
        <section className="bg-[#070a10] border-b border-[#1a2332] py-8 sm:py-10">
          <div className="page-padding">
            <div className={`flex items-center gap-1.5 text-[11px] text-[#4a5568] mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Link to="/" className="hover:text-[#00d4aa] transition-colors">{t.breadcrumb_home}</Link>
              <span>/</span>
              <span className="text-[#7a8a9e]">{t.page_breadcrumb_hiw}</span>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#00d4aa]">
                {t.hiw_eyebrow}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2">{t.page_hiw_title}</h1>
              <p className="mt-2 text-[13px] sm:text-[15px] text-[#5a6a7e] max-w-[600px]">
                {t.page_hiw_desc}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Video Demo */}
        <section className="page-padding py-8 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-[#111821] border border-[#1a2332] rounded-2xl overflow-hidden shadow-2xl">
              <div className="relative aspect-video">
                <video
                  src="/videos/how-it-works.mp4"
                  controls
                  preload="metadata"
                  className="w-full h-full object-cover"
                  poster="/videos/how-it-works-poster.jpg"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="px-6 py-4 border-t border-[#1a2332]">
                <p className="text-[13px] text-[#5a6a7e]">
                  Watch how DZ TechHunt helps you find the best PC component prices across Algeria.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Steps */}
        <section className="page-padding py-12 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative bg-[#111821] border border-[#1a2332] hover:border-[#00d4aa]/20 rounded-xl p-6 sm:p-8 transition-all duration-300"
              >
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 text-[#1a2332] font-mono text-3xl sm:text-4xl font-bold select-none">
                  {step.num}
                </div>
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#00d4aa]/10 border border-[#00d4aa]/20 flex items-center justify-center mb-4 sm:mb-5">
                  <step.icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#00d4aa]" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2">{step.title}</h3>
                <p className="text-[13px] sm:text-[14px] text-[#5a6a7e] leading-relaxed mb-4 sm:mb-5" dir={isRTL ? 'rtl' : 'ltr'}>
                  {step.desc}
                </p>
                <ul className="space-y-2">
                  {step.details.map((detail, j) => (
                    <li key={j} className="flex items-start gap-2 text-[12px] sm:text-[13px] text-[#7a8a9e]">
                      <Check className="w-3.5 h-3.5 text-[#00d4aa] shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="bg-[#070a10] border-y border-[#1a2332] py-12 sm:py-16 page-padding">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8 sm:mb-10"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Why DZ TechHunt?</h2>
            <p className="text-[13px] sm:text-[15px] text-[#5a6a7e]">
              Built for Algerian PC builders, by Algerian PC builders.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-[#111821] border border-[#1a2332] rounded-xl p-5 sm:p-6 text-center hover:border-[#00d4aa]/20 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-[#00d4aa]/10 border border-[#00d4aa]/20 flex items-center justify-center mx-auto mb-3">
                  <b.icon className="w-4 h-4 text-[#00d4aa]" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{b.title}</h3>
                <p className="text-[12px] text-[#5a6a7e]">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="page-padding py-12 sm:py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Ready to save?</h2>
            <p className="text-[13px] sm:text-[15px] text-[#5a6a7e] max-w-md mx-auto mb-6">
              Start searching for your next PC component and compare prices across all Algerian stores.
            </p>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#00d4aa] hover:bg-[#00b894] text-[#0a0e14] text-sm font-bold rounded-xl transition-colors"
            >
              Start Searching <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
