ALTER TABLE trip_members ADD COLUMN rsvp_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE trip_members ADD COLUMN arrival_date TEXT;
ALTER TABLE trip_members ADD COLUMN departure_date TEXT;
