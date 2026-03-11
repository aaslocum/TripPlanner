-- Unified bed request system: replaces both bedroom_claims (room-level)
-- and beds.assigned_user_id (bed-level immediate). Everything is now
-- bed-level with a request→confirm workflow. Multiple users can request
-- the same bed (couples sharing).

CREATE TABLE bed_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  bed_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested', 'confirmed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bed_id) REFERENCES beds(bed_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE(bed_id, user_id)
);

CREATE INDEX idx_bed_requests_bed ON bed_requests(bed_id);
CREATE INDEX idx_bed_requests_user ON bed_requests(user_id);

-- Migrate existing bed assignments as confirmed requests
INSERT INTO bed_requests (bed_id, user_id, status)
SELECT bed_id, assigned_user_id, 'confirmed'
FROM beds WHERE assigned_user_id IS NOT NULL;
