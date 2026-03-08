CREATE TABLE activities (
  activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  google_place_id TEXT,
  start_datetime TEXT,
  end_datetime TEXT,
  estimated_cost REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE
);

CREATE INDEX idx_activities_trip ON activities(trip_id);
CREATE INDEX idx_activities_start ON activities(start_datetime);
