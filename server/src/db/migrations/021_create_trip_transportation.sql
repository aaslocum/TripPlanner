CREATE TABLE trip_transportation (
  transport_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         INTEGER NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  mode            TEXT NOT NULL,
  departure_from  TEXT,
  arrival_datetime TEXT,
  return_datetime TEXT,
  flight_number   TEXT,
  car_capacity    INTEGER,
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  UNIQUE(trip_id, user_id)
);
