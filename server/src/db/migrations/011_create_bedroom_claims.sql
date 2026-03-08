CREATE TABLE bedroom_claims (
  claim_id INTEGER PRIMARY KEY AUTOINCREMENT,
  bedroom_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested', 'confirmed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bedroom_id) REFERENCES bedrooms(bedroom_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE(bedroom_id, user_id)
);

CREATE INDEX idx_bedroom_claims_bedroom ON bedroom_claims(bedroom_id);
CREATE INDEX idx_bedroom_claims_user ON bedroom_claims(user_id);
