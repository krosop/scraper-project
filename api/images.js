const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '73ce981791mshb4a156feea9b1a7p19ec69jsnec063d5afc65';
const RAPIDAPI_HOST = 'google-images4.p.rapidapi.com';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.query.q;
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const cacheKey = query.trim().toLowerCase();

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json({
      status: 'cached',
      query,
      imageUrl: cached.url,
    });
  }

  try {
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/getGoogleImages?query=${encodeURIComponent(query)}&count=5&imageInfo=true`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'Image API failed',
        details: errorText,
      });
    }

    const data = await response.json();

    if (!data.images || data.images.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }

    // Get the first image URL
    const imageUrl = data.images[0].url;

    // Store in cache
    cache.set(cacheKey, { url: imageUrl, timestamp: Date.now() });

    return res.status(200).json({
      status: 'success',
      query,
      imageUrl,
    });
  } catch (error) {
    console.error('Image fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch image' });
  }
}
