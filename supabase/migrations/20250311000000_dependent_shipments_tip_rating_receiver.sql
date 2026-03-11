ALTER TABLE dependent_shipments
  ADD COLUMN IF NOT EXISTS tip_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating smallint,
  ADD COLUMN IF NOT EXISTS receiver_name text;
