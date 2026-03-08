CREATE TABLE accommodations (
  accommodation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  airbnb_id TEXT,
  description TEXT,
  address TEXT,
  check_in_datetime TEXT,
  check_out_datetime TEXT,
  total_cost REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE
);

CREATE INDEX idx_accommodations_trip ON accommodations(trip_id);
