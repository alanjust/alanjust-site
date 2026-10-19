-- Review cards: a status per proof, a small thumbnail per version, and
-- when each person last looked at each proof (for "new comment" badges).

-- 'waiting' (Waiting for feedback), 'revising' or 'approved'
ALTER TABLE proofs ADD COLUMN status TEXT NOT NULL DEFAULT 'waiting';

-- R2 key of a small JPEG made in Alan's browser when he posts the version
ALTER TABLE proof_versions ADD COLUMN thumb_key TEXT;

CREATE TABLE proof_views (
  proof_id  TEXT NOT NULL REFERENCES proofs (id) ON DELETE CASCADE,
  email     TEXT NOT NULL,
  seen_at   TEXT NOT NULL,
  PRIMARY KEY (proof_id, email)
);
