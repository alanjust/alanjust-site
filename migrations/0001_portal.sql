-- Client portal: transfer files, review proofs and their comment threads.
-- A "space" is one client group, e.g. client 'osu', space 'packaging'.

-- Files in the two-way transfer area. Auto-deleted after 90 days.
CREATE TABLE files (
  id           TEXT PRIMARY KEY,
  client       TEXT NOT NULL,
  space        TEXT NOT NULL,
  r2_key       TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  size         INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  uploaded_by  TEXT NOT NULL,          -- email
  created_at   TEXT NOT NULL           -- ISO 8601
);
CREATE INDEX files_by_space ON files (client, space, created_at);

-- Uploads that have started but not finished (multipart, chunked).
CREATE TABLE uploads (
  id           TEXT PRIMARY KEY,       -- R2 multipart upload id
  r2_key       TEXT NOT NULL,
  client       TEXT NOT NULL,
  space        TEXT NOT NULL,
  kind         TEXT NOT NULL,          -- 'file' or 'proof'
  name         TEXT NOT NULL,
  size         INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  proof_id     TEXT,                   -- set when kind = 'proof'
  started_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

-- A proof is one thing under review ("Cider label, front").
CREATE TABLE proofs (
  id          TEXT PRIMARY KEY,
  client      TEXT NOT NULL,
  space       TEXT NOT NULL,
  title       TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX proofs_by_space ON proofs (client, space, updated_at);

-- Each upload of a proof is a new version with its own comment thread.
CREATE TABLE proof_versions (
  id           TEXT PRIMARY KEY,
  proof_id     TEXT NOT NULL REFERENCES proofs (id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  r2_key       TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  size         INTEGER NOT NULL,
  content_type TEXT NOT NULL,          -- application/pdf, image/jpeg or image/png
  note         TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (proof_id, version)
);

CREATE TABLE comments (
  id            TEXT PRIMARY KEY,
  version_id    TEXT NOT NULL REFERENCES proof_versions (id) ON DELETE CASCADE,
  author_email  TEXT NOT NULL,
  author_name   TEXT NOT NULL,
  body          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  addressed_at  TEXT                   -- set by Alan; comment stays visible, dimmed
);
CREATE INDEX comments_by_version ON comments (version_id, created_at);
