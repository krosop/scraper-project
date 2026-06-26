import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  price?: number;
  brand?: string;
  availability?: string;
  rating?: number;
  reviewCount?: number;
  keywords?: string;
}

const SITE_URL = 'https://dztechhunt-v3.vercel.app';
const DEFAULT_IMAGE = 'https://dztechhunt-v3.vercel.app/images/og-cover.jpg';
const DEFAULT_TITLE = 'DZTechHunt — Compare PC Prices in Algeria';
const DEFAULT_DESC = 'Compare prices for graphics cards, CPUs, motherboards, RAM, SSDs, monitors & PC parts from top Algerian stores. Find the best deals on RTX 5060, Ryzen, Intel & more.';
const DEFAULT_KEYWORDS = 'Algeria PC parts, graphics card price Algeria, RTX 5060 price Algeria, buy PC components Algeria, PC build Algeria, GPU price comparison Algeria, CPU price Algeria, motherboard Algeria, RAM price Algeria, SSD Algeria, monitor Algeria, gaming PC Algeria';

export default function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESC,
  image = DEFAULT_IMAGE,
  url = SITE_URL,
  type = 'website',
  price,
  brand,
  availability,
  rating,
  reviewCount,
  keywords = DEFAULT_KEYWORDS,
}: SEOProps) {
  const fullTitle = title === DEFAULT_TITLE ? title : `${title} | DZTechHunt`;

  const structuredData = type === 'product' && price ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    image,
    description,
    brand: {
      '@type': 'Brand',
      name: brand || 'PC Component',
    },
    offers: {
      '@type': 'AggregateOffer',
      url,
      priceCurrency: 'DZD',
      lowPrice: price,
      availability: availability === 'In stock' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    ...(rating && reviewCount ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: rating,
        reviewCount: reviewCount,
      },
    } : {}),
  }) : JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DZTechHunt',
    url: SITE_URL,
    description: DEFAULT_DESC,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/#/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  });

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      <link rel="canonical" href={url} />
      <meta name="language" content="en" />
      <meta name="geo.region" content="DZ" />
      <meta name="geo.placename" content="Algeria" />
      <meta name="author" content="DZTechHunt" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="DZTechHunt" />
      <meta property="og:locale" content="en_DZ" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <script type="application/ld+json">{structuredData}</script>
    </Helmet>
  );
}
