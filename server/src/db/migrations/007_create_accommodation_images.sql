CREATE TABLE accommodation_images (
  image_id INTEGER PRIMARY KEY AUTOINCREMENT,
  accommodation_id INTEGER NOT NULL,
  bedroom_id INTEGER,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (accommodation_id) REFERENCES accommodations(accommodation_id) ON DELETE CASCADE,
  FOREIGN KEY (bedroom_id) REFERENCES bedrooms(bedroom_id) ON DELETE SET NULL
);
