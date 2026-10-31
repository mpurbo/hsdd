-- The bookings (D6). Applied at every start and to every new test database;
-- every statement is IF NOT EXISTS, and there is no migration tool.
-- Instants are timestamptz (ADR-002 Decision 2); a booking occupies [start_at, end_at).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS booking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  account_id text NOT NULL,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  CONSTRAINT booking_starts_before_it_ends CHECK (start_at < end_at),
  CONSTRAINT booking_no_overlap EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
);
