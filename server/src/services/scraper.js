/**
 * Modular scraper service with platform-specific rules.
 * Each platform defines URL matching and data extraction logic.
 */

const PLATFORMS = {
  airbnb: {
    name: 'Airbnb',
    // Match airbnb.com/rooms/<id> or airbnb.com/h/<slug>
    match: (url) => /airbnb\.[a-z.]+\/(rooms|h)\//.test(url),

    extractListingId(url) {
      const match = url.match(/\/rooms\/(\d+)/);
      return match ? match[1] : null;
    },

    extractFromHtml(html, url) {
      const data = {};

      // Extract listing ID from URL
      data.airbnb_id = this.extractListingId(url) || '';

      // Extract check-in/check-out from URL query params
      try {
        const parsed = new URL(url);
        const checkIn = parsed.searchParams.get('check_in');
        const checkOut = parsed.searchParams.get('check_out');
        if (checkIn) data.check_in = checkIn;   // YYYY-MM-DD
        if (checkOut) data.check_out = checkOut;
      } catch { /* skip */ }

      // OG meta tags (reliably present for SEO/social sharing)
      const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/)
        || html.match(/<meta\s+content="([^"]*)"\s+property="og:title"/);
      if (ogTitle) data.description = decodeHtmlEntities(ogTitle[1]);

      const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/)
        || html.match(/<meta\s+content="([^"]*)"\s+property="og:description"/);
      if (ogDesc) data.og_description = decodeHtmlEntities(ogDesc[1]);

      const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/)
        || html.match(/<meta\s+content="([^"]*)"\s+property="og:image"/);
      if (ogImage) data.image_url = ogImage[1];

      // Try to extract address from meta tags or title
      // Airbnb titles often follow: "Name - Type in City, Region"
      if (data.description) {
        const locationMatch = data.description.match(/(?:in|at)\s+(.+?)(?:\s*[-|·]|$)/i);
        if (locationMatch) data.address = locationMatch[1].trim();
      }

      // Try to find structured data (JSON-LD)
      const jsonLdMatches = html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      for (const m of jsonLdMatches) {
        try {
          const ld = JSON.parse(m[1]);
          if (ld['@type'] === 'BreadcrumbList' && ld.itemListElement) {
            // Last breadcrumb often contains the location
            const last = ld.itemListElement[ld.itemListElement.length - 1];
            if (last?.name && !data.address) {
              data.address = last.name;
            }
          }
          if (ld.address) {
            data.address = typeof ld.address === 'string'
              ? ld.address
              : [ld.address.streetAddress, ld.address.addressLocality, ld.address.addressRegion].filter(Boolean).join(', ');
          }
        } catch { /* skip invalid JSON-LD */ }
      }

      // Try __NEXT_DATA__ for richer data
      const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const extracted = extractFromNextData(nextData);
          Object.assign(data, extracted);
        } catch { /* skip if parse fails */ }
      }

      // Extract listing images (filter to actual property photos, not UI assets)
      const images = [];
      const imgMatches = html.matchAll(/https:\/\/a0\.muscache\.com\/im\/pictures\/hosting\/Hosting-[^"'\s)]+\/original\/[^"'\s)]+/g);
      const seen = new Set();
      for (const m of imgMatches) {
        // Clean up HTML entities in URL
        const imgUrl = decodeHtmlEntities(m[0]);
        // Use original quality URL (strip resize params)
        const cleanUrl = imgUrl.replace(/\?.*$/, '');
        if (!seen.has(cleanUrl) && images.length < 20) {
          seen.add(cleanUrl);
          images.push(cleanUrl);
        }
      }
      if (images.length > 0) data.images = images;

      // Extract bedrooms from sleeping arrangement section
      data.bedrooms = extractBedrooms(html);

      return data;
    },
  },
};

// Map Airbnb bed type names to our schema bed types
const BED_TYPE_MAP = {
  'king': 'king',
  'queen': 'queen',
  'single': 'twin',
  'twin': 'twin',
  'double': 'full',
  'full': 'full',
  'sofa': 'sofa',
  'sofa bed': 'sofa',
  'couch': 'sofa',
  'bunk': 'bunk',
  'bunk bed': 'bunk',
};

function mapBedType(airbnbType) {
  const lower = airbnbType.toLowerCase().trim();
  for (const [key, value] of Object.entries(BED_TYPE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return 'queen'; // fallback
}

/**
 * Extract bedroom info from the sleeping arrangement HTML section.
 * Looks for <li data-key="Bedroom N"> elements containing bed descriptions.
 */
function extractBedrooms(html) {
  const bedrooms = [];

  // Match each bedroom list item: data-key="Bedroom N" ... name ... beds
  const bedroomPattern = /<li[^>]*data-key="(Bedroom \d+)"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = bedroomPattern.exec(html)) !== null) {
    const name = match[1];
    const content = match[2];

    // Extract bed description from _et7v9p6 class div
    const bedDescMatch = content.match(/<div class="_et7v9p6">(.*?)<\/div>/);
    if (!bedDescMatch) continue;

    const bedDesc = decodeHtmlEntities(bedDescMatch[1]);
    const beds = parseBedDescription(bedDesc);

    bedrooms.push({ name, bed_description: bedDesc, beds });
  }

  return bedrooms;
}

/**
 * Parse bed description like "1 king bed, 2 single beds" into structured data.
 */
function parseBedDescription(desc) {
  const beds = [];
  // Split by comma: "1 king bed, 2 single beds"
  const parts = desc.split(',').map(s => s.trim());
  for (const part of parts) {
    // Match pattern: "N type bed(s)"
    const m = part.match(/(\d+)\s+(.+?)\s+beds?/i);
    if (m) {
      const count = parseInt(m[1]);
      const type = mapBedType(m[2]);
      for (let i = 0; i < count; i++) {
        beds.push({ bed_type: type });
      }
    }
  }
  return beds;
}

/**
 * Walk through __NEXT_DATA__ to find listing details.
 * Airbnb's structure changes, so we search broadly.
 */
function extractFromNextData(nextData) {
  const result = {};

  try {
    // Traverse the nested data looking for listing info
    const str = JSON.stringify(nextData);

    // Look for location data
    const latMatch = str.match(/"lat":\s*(-?\d+\.?\d*)/);
    const lngMatch = str.match(/"lng":\s*(-?\d+\.?\d*)/);
    if (latMatch && lngMatch) {
      result.lat = parseFloat(latMatch[1]);
      result.lng = parseFloat(lngMatch[1]);
    }

    // Look for city/location
    const cityMatch = str.match(/"city":\s*"([^"]+)"/);
    if (cityMatch && !result.address) {
      result.address = cityMatch[1];
    }
  } catch { /* best effort */ }

  return result;
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Detect which platform a URL belongs to.
 */
export function detectPlatform(url) {
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    if (platform.match(url)) return key;
  }
  return null;
}

/**
 * Scrape a listing URL and return structured data.
 */
export async function scrapeListing(url) {
  const platform = detectPlatform(url);
  if (!platform) {
    throw new Error('Unsupported platform. Currently only Airbnb URLs are supported.');
  }

  const rules = PLATFORMS[platform];

  // Fetch the page HTML
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch listing page (HTTP ${response.status})`);
  }

  const html = await response.text();
  const data = rules.extractFromHtml(html, url);

  return {
    platform: rules.name,
    source_url: url,
    ...data,
  };
}
