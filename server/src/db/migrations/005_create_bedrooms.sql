CREATE TABLE bedrooms (
  bedroom_id INTEGER PRIMARY KEY AUTOINCREMENT,
  accommodation_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price_share_adjustment REAL DEFAULT 0.0,
  FOREIGN KEY (accommodation_id) REFERENCES accommodations(accommodation_id) ON DELETE CASCADE
);
