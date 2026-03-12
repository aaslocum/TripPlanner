-- Gear items: group packing/supply list for trip members
CREATE TABLE IF NOT EXISTS gear_items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  notes TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  image_url TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_gear_items_trip ON gear_items(trip_id);
CREATE INDEX idx_gear_items_creator ON gear_items(created_by);

-- Gear claims: who is bringing what quantity of each item
CREATE TABLE IF NOT EXISTS gear_claims (
  claim_id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES gear_items(item_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE(item_id, user_id)
);

CREATE INDEX idx_gear_claims_item ON gear_claims(item_id);
CREATE INDEX idx_gear_claims_user ON gear_claims(user_id);
