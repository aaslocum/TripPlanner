CREATE TABLE IF NOT EXISTS eats (
  eat_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  address TEXT,
  google_place_id TEXT,
  image_url TEXT,
  latitude REAL,
  longitude REAL,
  rating REAL,
  start_datetime TEXT,
  end_datetime TEXT,
  estimated_cost REAL,
  duration REAL,
  source_url TEXT,
  is_suggested INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
