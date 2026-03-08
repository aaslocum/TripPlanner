CREATE TABLE beds (
  bed_id INTEGER PRIMARY KEY AUTOINCREMENT,
  bedroom_id INTEGER NOT NULL,
  bed_type TEXT NOT NULL DEFAULT 'queen' CHECK(bed_type IN ('king', 'queen', 'twin', 'sofa', 'full', 'bunk')),
  assigned_user_id INTEGER,
  FOREIGN KEY (bedroom_id) REFERENCES bedrooms(bedroom_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
