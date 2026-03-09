CREATE TABLE IF NOT EXISTS proposals (
  proposal_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  proposal_name TEXT NOT NULL,
  proposal_text TEXT NOT NULL,
  places TEXT NOT NULL DEFAULT '[]',
  estimated_cost REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_proposals_trip ON proposals(trip_id)
