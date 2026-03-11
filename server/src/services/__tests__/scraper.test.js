import { describe, it, expect } from 'vitest';
import { detectPlatform } from '../scraper.js';

// We need to test internal functions. Since they're not exported,
// we re-implement the pure helper functions to verify behavior.

// Copy of mapBedType from scraper.js
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

function parseBedDescription(desc) {
  const beds = [];
  const parts = desc.split(',').map(s => s.trim());
  for (const part of parts) {
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

describe('detectPlatform', () => {
  it('detects Airbnb rooms URLs', () => {
    expect(detectPlatform('https://www.airbnb.com/rooms/12345')).toBe('airbnb');
  });

  it('detects Airbnb h/ slug URLs', () => {
    expect(detectPlatform('https://www.airbnb.com/h/cozy-cabin')).toBe('airbnb');
  });

  it('detects international Airbnb URLs', () => {
    expect(detectPlatform('https://www.airbnb.co.uk/rooms/99999')).toBe('airbnb');
  });

  it('detects Airbnb URLs with query params', () => {
    expect(detectPlatform('https://www.airbnb.com/rooms/12345?check_in=2026-04-10&check_out=2026-04-12')).toBe('airbnb');
  });

  it('detects Google Maps URLs', () => {
    expect(detectPlatform('https://www.google.com/maps/place/Some+Place')).toBe('google_maps');
  });

  it('detects maps.app.goo.gl short URLs', () => {
    expect(detectPlatform('https://maps.app.goo.gl/abc123')).toBe('google_maps');
  });

  it('detects share.google URLs', () => {
    expect(detectPlatform('https://share.google/abc123')).toBe('google_maps');
  });

  it('returns null for unsupported URLs', () => {
    expect(detectPlatform('https://www.example.com/listing')).toBeNull();
    expect(detectPlatform('https://booking.com/hotel/123')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });
});

describe('mapBedType', () => {
  it('maps standard bed types', () => {
    expect(mapBedType('king')).toBe('king');
    expect(mapBedType('queen')).toBe('queen');
    expect(mapBedType('single')).toBe('twin');
    expect(mapBedType('twin')).toBe('twin');
    expect(mapBedType('double')).toBe('full');
    expect(mapBedType('full')).toBe('full');
  });

  it('maps sofa variants', () => {
    expect(mapBedType('sofa')).toBe('sofa');
    expect(mapBedType('sofa bed')).toBe('sofa');
    expect(mapBedType('couch')).toBe('sofa');
  });

  it('maps bunk variants', () => {
    expect(mapBedType('bunk')).toBe('bunk');
    expect(mapBedType('bunk bed')).toBe('bunk');
  });

  it('is case-insensitive', () => {
    expect(mapBedType('KING')).toBe('king');
    expect(mapBedType('Queen')).toBe('queen');
    expect(mapBedType('SOFA BED')).toBe('sofa');
  });

  it('handles extra whitespace', () => {
    expect(mapBedType('  king  ')).toBe('king');
  });

  it('falls back to queen for unknown types', () => {
    expect(mapBedType('hammock')).toBe('queen');
    expect(mapBedType('waterbed')).toBe('queen');
  });
});

describe('parseBedDescription', () => {
  it('parses a single bed', () => {
    expect(parseBedDescription('1 king bed')).toEqual([{ bed_type: 'king' }]);
  });

  it('parses multiple beds of different types', () => {
    const result = parseBedDescription('1 king bed, 2 single beds');
    expect(result).toEqual([
      { bed_type: 'king' },
      { bed_type: 'twin' },
      { bed_type: 'twin' },
    ]);
  });

  it('parses multiple beds of same type', () => {
    const result = parseBedDescription('3 queen beds');
    expect(result).toHaveLength(3);
    expect(result.every(b => b.bed_type === 'queen')).toBe(true);
  });

  it('handles sofa bed descriptions', () => {
    const result = parseBedDescription('1 queen bed, 1 sofa bed');
    expect(result).toEqual([
      { bed_type: 'queen' },
      { bed_type: 'sofa' },
    ]);
  });

  it('returns empty array for non-matching descriptions', () => {
    expect(parseBedDescription('Spacious room with ocean view')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseBedDescription('')).toEqual([]);
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes &amp;', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });

  it('decodes &lt; and &gt;', () => {
    expect(decodeHtmlEntities('&lt;div&gt;')).toBe('<div>');
  });

  it('decodes &quot;', () => {
    expect(decodeHtmlEntities('&quot;hello&quot;')).toBe('"hello"');
  });

  it('decodes &#39; and &#x27;', () => {
    expect(decodeHtmlEntities("it&#39;s")).toBe("it's");
    expect(decodeHtmlEntities("it&#x27;s")).toBe("it's");
  });

  it('decodes &#x2F;', () => {
    expect(decodeHtmlEntities('path&#x2F;to')).toBe('path/to');
  });

  it('decodes multiple entities in one string', () => {
    expect(decodeHtmlEntities('&lt;a href=&quot;url&quot;&gt;link&lt;/a&gt;'))
      .toBe('<a href="url">link</a>');
  });

  it('returns unchanged text with no entities', () => {
    expect(decodeHtmlEntities('plain text')).toBe('plain text');
  });
});
