-- Prevent double-bookings at the database level.
--
-- The API checks for a conflicting booking and then inserts in two separate
-- steps (check-then-insert). That is a race condition: two concurrent requests
-- can both pass the conflict check before either row is written, producing two
-- overlapping bookings for the same staff member. An exclusion constraint
-- enforces non-overlap atomically inside the database, so the second INSERT is
-- always rejected — no matter how close together the two requests arrive.

-- btree_gist lets a single GiST index combine plain equality (resource_id)
-- with the range-overlap operator (&&) in one exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Two active bookings for the same resource may not overlap in time.
-- tstzrange defaults to '[)' (inclusive start, exclusive end), so a booking
-- ending at 10:00 does NOT collide with one starting at 10:00 — matching the
-- existing slot-conflict logic. Cancelled / completed / no-show bookings and
-- bookings without an assigned resource are excluded from the rule.
--
-- NOTE: this will fail if the table already contains overlapping active
-- bookings for the same resource. Resolve any such duplicates first.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (status IN ('pending', 'confirmed') AND resource_id IS NOT NULL);
