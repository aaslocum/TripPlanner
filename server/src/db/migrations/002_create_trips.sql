CREATE TABLE trips (
  trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
